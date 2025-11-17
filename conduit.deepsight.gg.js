var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
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
define("conduit.deepsight.gg/Inventory", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Inventory;
    (function (Inventory) {
        function test() {
        }
        Inventory.test = test;
    })(Inventory || (Inventory = {}));
    exports.default = Inventory;
});
define("conduit.deepsight.gg", ["require", "exports", "conduit.deepsight.gg/Definitions", "conduit.deepsight.gg/Inventory"], function (require, exports, Definitions_1, Inventory_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Inventory = void 0;
    Definitions_1 = __importDefault(Definitions_1);
    Object.defineProperty(exports, "Inventory", { enumerable: true, get: function () { return __importDefault(Inventory_1).default; } });
    if (!('serviceWorker' in navigator))
        throw new Error('Service Worker is not supported in this browser');
    const loaded = new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve, { once: true }));
    async function Conduit(options) {
        await loaded;
        const iframe = document.createElement('iframe');
        const serviceRoot = new URL(options.service ?? 'https://conduit.deepsight.gg');
        const serviceOrigin = serviceRoot.origin;
        iframe.src = `${serviceRoot}service`;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        await new Promise(resolve => iframe.addEventListener('load', resolve, { once: true }));
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
        function addPromiseListener(type) {
            const id = Math.random().toString(36).slice(2);
            return {
                id,
                promise: new Promise((resolve, reject) => {
                    addListener(id, `resolve:${type}`, data => {
                        resolve(data);
                        removeListener(id);
                    }, true);
                    addListener(id, `reject:${type}`, data => {
                        reject(data instanceof Error ? data : new Error('Promise message rejected', { cause: data }));
                        removeListener(id);
                    }, true);
                }),
            };
        }
        function callPromiseFunction(type, ...params) {
            const { id, promise } = addPromiseListener(type);
            iframe.contentWindow?.postMessage({ type, id, data: params }, serviceOrigin);
            return promise;
        }
        let setActive;
        const activePromise = new Promise(resolve => setActive = resolve);
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
        await activePromise;
        const implementation = {
            definitions: undefined,
            on: new Proxy({}, {
                get(target, eventName) {
                    return (handler) => {
                        addListener('global', eventName, handler);
                        return () => {
                            const index = messageListeners.findIndex(listener => listener.type === 'global' && listener.type === eventName && listener.callback === handler);
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
                return (...params) => callPromiseFunction(fname, ...params);
            },
        });
        await conduit.setOrigin();
        Object.assign(conduit, { definitions: (0, Definitions_1.default)(conduit) });
        return conduit;
    }
    exports.default = Conduit;
});
