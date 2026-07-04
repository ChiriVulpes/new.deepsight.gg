var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define("conduit.deepsight.gg/Inventory", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Inventory;
    (function (Inventory) {
        function applyPatch(inventory, patch) {
            return applyPatchResult(inventory, patch).inventory;
        }
        Inventory.applyPatch = applyPatch;
        function applyPatchResult(inventory, patch) {
            const next = cloneInventory(inventory);
            switch (patch.type) {
                case 'move': {
                    const source = getLocationItems(next, patch.from);
                    const destination = getLocationItems(next, patch.to);
                    const index = findItemIndex(source, patch.item);
                    if (index === -1) {
                        if (findItemIndex(destination, patch.item) !== -1)
                            return { inventory, applied: true };
                        const alternateSource = findMoveSource(next, patch.item, destination);
                        if (!alternateSource)
                            return { inventory, applied: false };
                        const alternateIndex = findItemIndex(alternateSource, patch.item);
                        if (alternateIndex === -1)
                            return { inventory, applied: false };
                        const [item] = alternateSource.splice(alternateIndex, 1);
                        const movedItem = itemForMoveDestination(next, patch, item);
                        applyEquipmentDisplacement(next, patch, movedItem);
                        destination.push(movedItem);
                        return { inventory: next, applied: true };
                    }
                    const [item] = source.splice(index, 1);
                    const movedItem = itemForMoveDestination(next, patch, item);
                    applyEquipmentDisplacement(next, patch, movedItem);
                    destination.push(movedItem);
                    return { inventory: next, applied: true };
                }
                case 'bucket-correction': {
                    const items = getLocationItems(next, patch.location);
                    const index = findBucketCorrectionItemIndex(items, patch.item, patch.fromBucketHash);
                    const item = items[index];
                    if (!item)
                        return { inventory, applied: false };
                    items[index] = { ...item, bucketHash: patch.bucketHash };
                    return { inventory: next, applied: true };
                }
            }
            return { inventory, applied: false };
        }
        Inventory.applyPatchResult = applyPatchResult;
        function applyPatches(inventory, patches) {
            return patches.reduce(applyPatch, inventory);
        }
        Inventory.applyPatches = applyPatches;
        function applyPatchBatchResult(inventory, patches) {
            let current = inventory;
            const missed = [];
            let applied = false;
            for (const patch of patches) {
                const result = applyPatchResult(current, patch);
                current = result.inventory;
                if (result.applied)
                    applied = true;
                else
                    missed.push(patch);
            }
            return {
                inventory: current,
                applied,
                missed,
            };
        }
        function observeTransfers(source, options) {
            const pending = new Map();
            const operations = new Map();
            const predictedOperationKeys = new Map();
            const failures = new Map();
            const patchMisses = new Map();
            const patchEvents = [];
            const failureTimeouts = new Map();
            let baseInventory = options.getInventory();
            const emitState = () => options.onTransferStateChange?.({
                pending: [...pending.values()],
                failures: [...failures.values()],
                patchMisses: [...patchMisses.values()],
            });
            const setBaseInventory = (inventory) => {
                baseInventory = inventory;
                patchEvents.splice(0, Infinity);
                if (inventory)
                    options.setInventory(inventory);
            };
            const clearPatchMisses = (operationId) => {
                for (const key of patchMisses.keys())
                    if (key === operationId || key.startsWith(`${operationId}:`))
                        patchMisses.delete(key);
            };
            const clearFailure = (operationId) => {
                const timeout = failureTimeouts.get(operationId);
                if (timeout !== undefined)
                    clearTimeout(timeout);
                failures.delete(operationId);
                failureTimeouts.delete(operationId);
            };
            const unsubscribers = [
                source.on.itemTransferIntent(intent => {
                    const operationKey = operationDedupeKey(intent);
                    const predictedOperationId = predictedOperationKeys.get(operationKey);
                    if (predictedOperationId) {
                        const predictedOperation = operations.get(predictedOperationId);
                        pending.delete(predictedOperationId);
                        operations.delete(predictedOperationId);
                        predictedOperationKeys.delete(operationKey);
                        if (predictedOperation)
                            pending.set(intent.operationId, { ...intent, affectedItems: predictedOperation.affectedItems });
                        else
                            pending.set(intent.operationId, enrichOperation(intent, options.getInventory()));
                        operations.set(intent.operationId, pending.get(intent.operationId));
                        emitState();
                        return;
                    }
                    const operation = enrichOperation(intent, options.getInventory());
                    pending.set(intent.operationId, operation);
                    operations.set(intent.operationId, operation);
                    clearPatchMisses(intent.operationId);
                    clearFailure(intent.operationId);
                    emitState();
                }),
                source.on.inventoryPatch(event => {
                    if (event.profile.id !== options.getCurrentProfileId())
                        return;
                    baseInventory ??= options.getInventory();
                    patchEvents.push({
                        operationId: event.operationId,
                        patches: event.patches,
                    });
                    if (!baseInventory)
                        return;
                    const result = applyPatchBatchResult(baseInventory, patchEvents.flatMap(event => event.patches));
                    if (result.applied)
                        clearPatchMisses(event.operationId);
                    if (result.missed.length)
                        for (const patch of result.missed)
                            patchMisses.set(`${event.operationId}:${patchMisses.size}`, {
                                operation: operations.get(event.operationId),
                                patch,
                            });
                    options.setInventory(result.inventory);
                    clearFailure(event.operationId);
                    emitState();
                }),
                source.on.itemTransferFailure(failure => {
                    pending.delete(failure.operationId);
                    const operation = operations.get(failure.operationId);
                    if (operation) {
                        clearFailure(failure.operationId);
                        failures.set(failure.operationId, { ...operation, failure });
                        const timeout = setTimeout(() => {
                            failures.delete(failure.operationId);
                            failureTimeouts.delete(failure.operationId);
                            emitState();
                        }, 5000);
                        failureTimeouts.set(failure.operationId, timeout);
                    }
                    emitState();
                }),
                source.on.itemTransferComplete(complete => {
                    pending.delete(complete.operationId);
                    operations.delete(complete.operationId);
                    clearFailure(complete.operationId);
                    emitState();
                }),
            ];
            emitState();
            return {
                addPredictedOperation(operation) {
                    const predictedOperation = {
                        ...operation,
                        operationId: operation.operationId ?? `predicted:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
                    };
                    const key = operationDedupeKey(predictedOperation);
                    const existingOperationId = predictedOperationKeys.get(key);
                    if (existingOperationId) {
                        pending.delete(existingOperationId);
                        operations.delete(existingOperationId);
                    }
                    pending.set(predictedOperation.operationId, predictedOperation);
                    operations.set(predictedOperation.operationId, predictedOperation);
                    predictedOperationKeys.set(key, predictedOperation.operationId);
                    emitState();
                    return () => {
                        if (!pending.has(predictedOperation.operationId))
                            return;
                        pending.delete(predictedOperation.operationId);
                        operations.delete(predictedOperation.operationId);
                        if (predictedOperationKeys.get(key) === predictedOperation.operationId)
                            predictedOperationKeys.delete(key);
                        emitState();
                    };
                },
                setBaseInventory,
                unsubscribe() {
                    unsubscribers.forEach(unsubscribe => unsubscribe());
                    for (const timeout of failureTimeouts.values())
                        clearTimeout(timeout);
                },
            };
        }
        Inventory.observeTransfers = observeTransfers;
        function transfers(source, options) {
            const observer = observeTransfers(source, {
                ...options,
                onTransferStateChange: state => {
                    options.onTransferStateChange?.(state);
                },
            });
            const runPredicted = async (operation, run) => {
                const clear = observer.addPredictedOperation(operation);
                try {
                    await run();
                }
                finally {
                    clear();
                }
            };
            const transferOptions = { recoveryPolicy: 'best-effort-revert' };
            const moveItemToCharacter = async (itemLike, characterId = options.getDefaultCharacterId?.()) => {
                const item = itemInstanceFromLike(itemLike);
                if (!item || !characterId)
                    return;
                const location = findCurrentItemLocation(options.getInventory(), item);
                if (location?.location !== 'vault')
                    return;
                const reference = itemReferenceFromInstance(location.item);
                await runPredicted({
                    action: 'move-item-to-character',
                    item: reference,
                    affectedItems: affectedItemsForAction('move-item-to-character', location.item, options.getInventory()),
                    to: 'character',
                    characterId,
                }, async () => await source.moveItemToCharacter(characterId, reference, transferOptions));
            };
            const equipItem = async (itemLike) => {
                const item = itemInstanceFromLike(itemLike);
                if (!item)
                    return;
                const location = findCurrentItemLocation(options.getInventory(), item);
                if (location?.location === 'vault') {
                    await moveItemToCharacter(location.item, options.getDefaultCharacterId?.());
                    return;
                }
                if (location?.location !== 'character-inventory' || location.item.bucketHash === 215593132 /* InventoryBucketHashes.LostItems */)
                    return;
                const reference = itemReferenceFromInstance(location.item, location.characterId);
                await runPredicted({
                    action: 'equip-item-on-character',
                    item: reference,
                    affectedItems: affectedItemsForAction('equip-item-on-character', location.item, options.getInventory(), location.characterId),
                    to: 'equipped',
                    characterId: location.characterId,
                }, async () => await source.equipItemOnCharacter(location.characterId, reference, transferOptions));
            };
            const vaultItem = async (itemLike) => {
                const item = itemInstanceFromLike(itemLike);
                if (!item)
                    return;
                const location = findCurrentItemLocation(options.getInventory(), item);
                if (location?.location !== 'character-inventory' || location.item.bucketHash === 215593132 /* InventoryBucketHashes.LostItems */)
                    return;
                const reference = itemReferenceFromInstance(location.item, location.characterId);
                await runPredicted({
                    action: 'vault-item',
                    item: reference,
                    affectedItems: affectedItemsForAction('vault-item', location.item, options.getInventory(), location.characterId),
                    to: 'vault',
                }, async () => await source.vaultItem(reference, transferOptions));
            };
            return {
                equipItem,
                vaultItem,
                moveItemToCharacter,
                setBaseInventory: observer.setBaseInventory,
                unsubscribe() {
                    observer.unsubscribe();
                },
            };
        }
        Inventory.transfers = transfers;
        function enrichOperation(intent, inventory) {
            const affectedItems = [intent.item];
            if (intent.action === 'equip-item-on-character' && intent.characterId && inventory) {
                const character = inventory.characters[intent.characterId];
                const sourceItem = character?.items.find(item => itemMatchesReference(item, intent.item));
                if (sourceItem)
                    affectedItems.push(...affectedItemsForAction(intent.action, sourceItem, inventory, intent.characterId).slice(1));
            }
            return { ...intent, affectedItems };
        }
        function affectedItemsForAction(action, item, inventory, characterId) {
            const affectedItems = [itemReferenceFromInstance(item, characterId)];
            if (action === 'equip-item-on-character' && characterId) {
                const equippedItems = inventory?.characters[characterId]?.equippedItems ?? [];
                affectedItems.push(...equippedItems
                    .filter(candidate => candidate.bucketHash === item.bucketHash && !itemInstanceMatches(candidate, item))
                    .map(item => itemReferenceFromInstance(item, characterId)));
            }
            return affectedItems;
        }
        function itemInstanceFromLike(itemLike) {
            if (!itemLike)
                return undefined;
            return hasInstanceProperty(itemLike) ? itemLike.instance : itemLike;
        }
        function hasInstanceProperty(itemLike) {
            return 'instance' in itemLike;
        }
        function findCurrentItemLocation(inventory, item) {
            if (!inventory)
                return undefined;
            for (const character of Object.values(inventory.characters)) {
                const inventoryItem = character.items.find(candidate => itemInstanceMatches(candidate, item));
                if (inventoryItem)
                    return { item: inventoryItem, characterId: character.id, location: 'character-inventory' };
                const equippedItem = character.equippedItems.find(candidate => itemInstanceMatches(candidate, item));
                if (equippedItem)
                    return { item: equippedItem, characterId: character.id, location: 'character-equipment' };
            }
            const profileItem = inventory.profileItems.find(candidate => itemInstanceMatches(candidate, item));
            if (profileItem)
                return { item: profileItem, location: profileItem.bucketHash === 138197802 /* InventoryBucketHashes.General */ ? 'vault' : 'profile' };
            return undefined;
        }
        function operationDedupeKey(operation) {
            return [
                operation.action,
                operation.characterId ?? '',
                operation.to ?? '',
                operation.item.instanceId ?? '',
                operation.item.itemHash,
                operation.item.characterId ?? '',
                operation.item.stackSize ?? '',
                operation.item.bucketHash ?? '',
            ].join(':');
        }
        function itemReferenceFromInstance(item, characterId) {
            return {
                instanceId: item.id,
                itemHash: item.itemHash,
                characterId,
                stackSize: item.quantity,
                bucketHash: item.bucketHash,
            };
        }
        function cloneInventory(inventory) {
            return {
                ...inventory,
                characters: Object.fromEntries(Object.entries(inventory.characters).map(([id, character]) => [id, {
                        ...character,
                        items: [...character.items],
                        equippedItems: [...character.equippedItems],
                    }])),
                profileItems: [...inventory.profileItems],
            };
        }
        function getLocationItems(inventory, location) {
            switch (location.container) {
                case 'vault':
                    return inventory.profileItems;
                case 'characterInventory':
                case 'postmaster':
                    return inventory.characters[location.characterId]?.items ?? [];
                case 'characterEquipment':
                    return inventory.characters[location.characterId]?.equippedItems ?? [];
            }
        }
        function findMoveSource(inventory, reference, destination) {
            for (const character of Object.values(inventory.characters)) {
                for (const items of [character.items, character.equippedItems])
                    if (items !== destination && findItemIndex(items, reference) !== -1)
                        return items;
            }
            return inventory.profileItems !== destination && findItemIndex(inventory.profileItems, reference) !== -1
                ? inventory.profileItems
                : undefined;
        }
        function itemForMoveDestination(inventory, patch, item) {
            const bucketHash = bucketHashForMoveDestination(inventory, patch, item);
            return bucketHash === item.bucketHash ? item : { ...item, bucketHash };
        }
        function bucketHashForMoveDestination(inventory, patch, item) {
            switch (patch.to.container) {
                case 'vault':
                    return 138197802 /* InventoryBucketHashes.General */;
                case 'characterInventory':
                case 'characterEquipment':
                case 'postmaster':
                    return inventory.items[item.itemHash]?.bucketHash ?? item.bucketHash;
            }
        }
        function applyEquipmentDisplacement(inventory, patch, item) {
            if (patch.from.container !== 'characterInventory' || patch.to.container !== 'characterEquipment' || patch.from.characterId !== patch.to.characterId)
                return;
            const character = inventory.characters[patch.to.characterId];
            if (!character)
                return;
            for (let i = character.equippedItems.length - 1; i >= 0; i--) {
                const equippedItem = character.equippedItems[i];
                if (equippedItem.bucketHash !== item.bucketHash || itemInstanceMatches(equippedItem, item))
                    continue;
                character.equippedItems.splice(i, 1);
                if (!character.items.some(candidate => itemInstanceMatches(candidate, equippedItem)))
                    character.items.push(equippedItem);
            }
        }
        function findItemIndex(items, reference) {
            const index = items.findIndex(item => itemMatchesReference(item, reference));
            if (index !== -1)
                return index;
            return -1;
        }
        function findBucketCorrectionItemIndex(items, reference, fromBucketHash) {
            const sourceBucketHash = fromBucketHash ?? reference.bucketHash;
            const index = items.findIndex(item => itemMatchesBucketCorrectionReference(item, reference, sourceBucketHash));
            if (index !== -1)
                return index;
            return -1;
        }
        function itemMatchesReference(item, reference) {
            if (reference.instanceId)
                return item.id === reference.instanceId;
            return item.id === undefined
                && item.itemHash === reference.itemHash
                && item.quantity === reference.stackSize
                && (reference.bucketHash === undefined || item.bucketHash === reference.bucketHash);
        }
        function itemMatchesBucketCorrectionReference(item, reference, fromBucketHash) {
            if (reference.instanceId)
                return item.id === reference.instanceId
                    && (fromBucketHash === undefined || item.bucketHash === fromBucketHash);
            return item.id === undefined
                && item.itemHash === reference.itemHash
                && item.quantity === reference.stackSize
                && (fromBucketHash === undefined || item.bucketHash === fromBucketHash);
        }
        function itemInstanceMatches(candidate, item) {
            return item.id
                ? candidate.id === item.id
                : candidate.id === undefined && candidate.itemHash === item.itemHash && candidate.quantity === item.quantity;
        }
    })(Inventory || (Inventory = {}));
    exports.default = Inventory;
});
define("conduit.deepsight.gg/Definitions", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function Definitions(conduit) {
        return new Proxy({}, {
            get(target, languageName) {
                return target[languageName] ??= new Proxy({}, {
                    get(target, componentName) {
                        return target[componentName] ??= {
                            async all(filter) {
                                return await conduit._getDefinitionsComponent(languageName, componentName, !filter ? undefined : { ...filter, evalExpression: filter?.evalExpression?.toString() });
                            },
                            async page(pageSize, page, filter) {
                                return await conduit._getDefinitionsComponentPage(languageName, componentName, pageSize, page, !filter ? undefined : { ...filter, evalExpression: filter?.evalExpression?.toString() });
                            },
                            async imagePage(pageSize, page, filter) {
                                return await conduit._getDefinitionsComponentImagePage(languageName, componentName, pageSize, page, !filter ? undefined : { ...filter, evalExpression: filter?.evalExpression?.toString() });
                            },
                            async get(hash) {
                                return hash === undefined ? undefined : await conduit._getDefinition(languageName, componentName, hash);
                            },
                            async links(hash) {
                                return hash === undefined ? undefined : await conduit._getDefinitionLinks(languageName, componentName, hash);
                            },
                            async getWithLinks(hash) {
                                return hash === undefined ? undefined : await conduit._getDefinitionWithLinks(languageName, componentName, hash);
                            },
                            async getReferencing(hash, pageSize, page) {
                                return hash === undefined ? undefined : await conduit._getDefinitionsReferencingPage(languageName, componentName, hash, pageSize, page);
                            },
                        };
                    },
                });
            },
        });
    }
    exports.default = Definitions;
});
define("conduit.deepsight.gg", ["require", "exports", "conduit.deepsight.gg/Inventory", "conduit.deepsight.gg/Definitions", "conduit.deepsight.gg/Inventory"], function (require, exports, Inventory_1, Definitions_1, Inventory_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Inventory = void 0;
    Inventory_1 = __importDefault(Inventory_1);
    Definitions_1 = __importDefault(Definitions_1);
    Object.defineProperty(exports, "Inventory", { enumerable: true, get: function () { return __importDefault(Inventory_2).default; } });
    if (!('serviceWorker' in navigator))
        throw new Error('Service Worker is not supported in this browser');
    const REQUEST_TIMEOUT = 1000 * 60 * 2;
    const STARTUP_TIMEOUT = 1000 * 30;
    const loaded = document.readyState === 'loading'
        ? new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve, { once: true }))
        : Promise.resolve();
    function toError(data) {
        if (data instanceof Error)
            return data;
        if (data && typeof data === 'object' && '__conduitError' in data) {
            const serialized = data;
            const err = new Error(serialized.message, { cause: serialized.cause });
            err.name = serialized.name ?? err.name;
            err.stack = serialized.stack;
            return err;
        }
        return new Error('Promise message rejected', { cause: data });
    }
    function timeoutError(label, timeout) {
        return new Error(`${label} timed out after ${timeout}ms`);
    }
    function withTimeout(promise, label, timeout = REQUEST_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(timeoutError(label, timeout)), timeout);
            promise.then(value => {
                clearTimeout(timeoutId);
                resolve(value);
            }, err => {
                clearTimeout(timeoutId);
                reject(err instanceof Error ? err : new Error('Promise rejected', { cause: err }));
            });
        });
    }
    async function Conduit(options) {
        await loaded;
        const iframe = document.createElement('iframe');
        const serviceRoot = new URL(options.service ?? 'https://conduit.deepsight.gg');
        const serviceOrigin = serviceRoot.origin;
        iframe.src = `${serviceRoot}service`;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        const messageListeners = [];
        function addListener(id, type, callback, once = false) {
            const expiry = !once ? undefined : Date.now() + 1000 * 60 * 2; // 2 minute expiry for once listeners
            const listener = {
                id,
                type,
                callback,
                once: once ? true : undefined,
                expiry,
            };
            messageListeners.push(listener);
            return listener;
        }
        function removeListener(id) {
            const index = messageListeners.findIndex(listener => listener.id === id);
            if (index !== -1)
                messageListeners.splice(index, 1);
        }
        function removeListeners(id) {
            for (let i = 0; i < messageListeners.length; i++) {
                if (messageListeners[i].id !== id)
                    continue;
                messageListeners.splice(i, 1);
                i--;
            }
        }
        function addPromiseListener(type) {
            const id = Math.random().toString(36).slice(2, 13);
            let timeout;
            let settled = false;
            function settle(callback, value) {
                if (settled)
                    return;
                settled = true;
                if (timeout)
                    clearTimeout(timeout);
                callback(value);
            }
            return {
                id,
                promise: new Promise((resolve, reject) => {
                    timeout = setTimeout(() => {
                        settled = true;
                        removeListeners(id);
                        reject(timeoutError(`Conduit request '${type}' (${id})`, REQUEST_TIMEOUT));
                    }, REQUEST_TIMEOUT);
                    addListener(id, `resolve:${type}`, data => {
                        settle(resolve, data);
                        removeListener(id);
                    }, true);
                    addListener(id, `reject:${type}`, data => {
                        settle(reject, toError(data));
                        removeListener(id);
                    }, true);
                }),
            };
        }
        function callPromiseFunction(type, ...params) {
            if (!iframe.contentWindow)
                return Promise.reject(new Error(`Conduit iframe is unavailable for '${type}'`));
            const { id, promise } = addPromiseListener(type);
            iframe.contentWindow?.postMessage({ type, id, data: params }, serviceOrigin);
            return promise;
        }
        const responseCache = new Map();
        const collectionCacheKey = (displayName, displayNameCode) => displayName && displayNameCode ? `collections:${displayName}:${displayNameCode}` : 'collections:current';
        const inventoryCacheKey = (displayName, displayNameCode) => `inventory:${displayName}:${displayNameCode}`;
        function cacheValue(key, version, value) {
            responseCache.set(key, {
                version,
                value,
            });
            return value;
        }
        async function callCachedResponse(key, type, ...params) {
            const cached = responseCache.get(key);
            const response = await callPromiseFunction(type, ...params, cached?.version);
            if ('unchanged' in response) {
                if (!cached)
                    throw new Error(`Conduit cache '${key}' was not available for unchanged response`);
                return cached.value;
            }
            return cacheValue(key, response.version, response.value);
        }
        function clearProfileResponseCaches() {
            for (const key of responseCache.keys())
                if (key.startsWith('inventory:') || key.startsWith('collections:'))
                    responseCache.delete(key);
        }
        let setActive;
        const activePromise = withTimeout(new Promise(resolve => setActive = resolve), 'Conduit iframe active signal', STARTUP_TIMEOUT);
        window.addEventListener('message', event => {
            if (event.source !== iframe.contentWindow)
                return;
            const data = event.data;
            if (typeof data !== 'object' || typeof data.type !== 'string') {
                console.warn('Incomprehensible message from Conduit iframe:', data);
                return;
            }
            if (data.type === '_active') {
                setActive?.();
                return;
            }
            let used = false;
            for (let i = 0; i < messageListeners.length; i++) {
                const listener = messageListeners[i];
                if (listener.type === data.type && listener.id === data.id) {
                    listener.callback(data.data);
                    used = true;
                    if (listener.once) {
                        messageListeners.splice(i, 1);
                        i--;
                        continue;
                    }
                }
                if (listener.expiry && listener.expiry < Date.now()) {
                    messageListeners.splice(i, 1);
                    i--;
                }
            }
            if (used)
                return;
            console.log('Unhandled message:', data);
        });
        await withTimeout(new Promise(resolve => iframe.addEventListener('load', resolve, { once: true })), 'Conduit iframe load', STARTUP_TIMEOUT);
        await activePromise;
        const implementation = {
            definitions: undefined,
            on: new Proxy({}, {
                get(target, eventName) {
                    return (handler) => {
                        addListener('global', eventName, handler);
                        return () => {
                            const index = messageListeners.findIndex(listener => listener.id === 'global' && listener.type === eventName && listener.callback === handler);
                            if (index !== -1)
                                messageListeners.splice(index, 1);
                        };
                    };
                },
            }),
            async update() {
                return frame.update();
            },
            async ensureAuthenticated(appName) {
                if (!await frame.needsAuth())
                    return true;
                let proxy = null;
                const authURL = `${serviceRoot}?auth=${encodeURIComponent(window.origin)}${appName ? `&app=${encodeURIComponent(appName)}` : ''}`;
                switch (options.authOptions) {
                    case 'blank':
                        proxy = window.open(authURL, '_blank');
                        break;
                    case 'navigate':
                        window.location.href = `${authURL}&redirect=${encodeURIComponent(window.location.href)}`;
                        break;
                    default: {
                        const width = options.authOptions?.width ?? 600;
                        const height = options.authOptions?.height ?? 800;
                        const screenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
                        const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
                        const screenWidth = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
                        const screenHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;
                        const left = ((screenWidth - width) / 2) + screenLeft;
                        const top = ((screenHeight - height) / 2) + screenTop;
                        proxy = window.open(authURL, '_blank', `width=${width},height=${height},left=${left},top=${top}`);
                        break;
                    }
                }
                if (proxy)
                    await new Promise(resolve => {
                        const interval = setInterval(() => {
                            if (proxy?.closed) {
                                clearInterval(interval);
                                resolve();
                            }
                        }, 10);
                    });
                return !await frame.needsAuth();
            },
        };
        const cachedFunctions = {
            async getCollections(displayName, displayNameCode) {
                return await callCachedResponse(collectionCacheKey(displayName, displayNameCode), 'getCollectionsVersioned', displayName, displayNameCode);
            },
            async getInventory(displayName, displayNameCode) {
                return await callCachedResponse(inventoryCacheKey(displayName, displayNameCode), 'getInventoryVersioned', displayName, displayNameCode);
            },
            async getInventoryCached(displayName, displayNameCode) {
                return await callCachedResponse(inventoryCacheKey(displayName, displayNameCode), 'getInventoryCachedVersioned', displayName, displayNameCode);
            },
        };
        addListener('global', 'profilesUpdated', clearProfileResponseCaches);
        addListener('global', 'inventoryUpdated', ({ profile, inventory }) => {
            const key = inventoryCacheKey(profile.name, profile.code ?? 0);
            responseCache.set(key, {
                version: responseCache.get(key)?.version ?? `broadcast:${Date.now().toString(36)}`,
                value: inventory,
            });
        });
        addListener('global', 'inventoryPatch', ({ profile, patches }) => {
            const key = inventoryCacheKey(profile.name, profile.code ?? 0);
            const cached = responseCache.get(key);
            if (!cached?.value)
                return;
            responseCache.set(key, {
                version: cached.version,
                value: Inventory_1.default.applyPatches(cached.value, patches),
            });
        });
        const frame = new Proxy({}, {
            get(target, fname) {
                if (fname === 'then')
                    return undefined;
                return (...params) => callPromiseFunction(`_${fname}`, ...params);
            },
        });
        const conduit = new Proxy(implementation, {
            get(target, fname) {
                if (fname === 'then')
                    return undefined;
                if (fname in target)
                    return target[fname];
                if (fname in cachedFunctions)
                    return cachedFunctions[fname];
                return (...params) => callPromiseFunction(fname, ...params);
            },
        });
        await conduit.setOrigin();
        Object.assign(conduit, { definitions: (0, Definitions_1.default)(conduit) });
        return conduit;
    }
    exports.default = Conduit;
});
