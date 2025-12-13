var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define("kitsui/utility/Type", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
define("kitsui/utility/Arrays", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Truthy = exports.NonNullish = void 0;
    const NonNullish = (value) => value !== null && value !== undefined;
    exports.NonNullish = NonNullish;
    const Truthy = (value) => Boolean(value);
    exports.Truthy = Truthy;
    var Arrays;
    (function (Arrays) {
        function resolve(value) {
            return Array.isArray(value) ? value : [value];
        }
        Arrays.resolve = resolve;
        Arrays.filterInPlace = (array, predicate) => {
            let readCursor = 0;
            let writeCursor = 0;
            while (readCursor < array.length) {
                const value = array[readCursor++];
                if (predicate(value, readCursor - 1, array))
                    array[writeCursor++] = value;
            }
            array.length = writeCursor;
            return array;
        };
        Arrays.distinctInPlace = (array, mapper) => {
            const encountered = [];
            let readCursor = 0;
            let writeCursor = 0;
            while (readCursor < array.length) {
                const value = array[readCursor++];
                const encounterValue = mapper ? mapper(value) : value;
                if (encountered.includes(encounterValue))
                    continue;
                encountered.push(encounterValue);
                array[writeCursor++] = value;
            }
            array.length = writeCursor;
            return array;
        };
        function remove(array, value) {
            const index = array.indexOf(value);
            if (index === -1)
                return array;
            array.splice(index, 1);
            return array;
        }
        Arrays.remove = remove;
    })(Arrays || (Arrays = {}));
    exports.default = Arrays;
});
define("kitsui/utility/Functions", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Functions;
    (function (Functions) {
        Functions.NO_OP = () => { };
        function resolve(fn, ...args) {
            return typeof fn === 'function' ? fn(...args) : fn;
        }
        Functions.resolve = resolve;
        function throwing(message) {
            return () => {
                throw new Error(message);
            };
        }
        Functions.throwing = throwing;
    })(Functions || (Functions = {}));
    exports.default = Functions;
});
define("kitsui/utility/Objects", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DefineMagic = exports.DefineProperty = exports.mutable = void 0;
    const mutable = (value) => value;
    exports.mutable = mutable;
    const DefineProperty = (obj, key, value) => {
        try {
            Object.defineProperty(obj, key, {
                configurable: true,
                writable: true,
                value,
            });
        }
        catch { }
        return value;
    };
    exports.DefineProperty = DefineProperty;
    const DefineMagic = (obj, key, definition) => {
        try {
            Object.defineProperty(obj, key, {
                configurable: true,
                ...definition,
            });
        }
        catch { }
    };
    exports.DefineMagic = DefineMagic;
});
define("kitsui/utility/Timeout", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Timeout;
    (function (Timeout) {
        const timeouts = [];
        // function validateTimeouts () {
        // 	let i = 0
        // 	for (i; i < timeouts.length && timeouts[i].until !== 0; i++)
        // 		// traverse active timeouts
        // 		continue
        // 	for (i; i < timeouts.length; i++)
        // 		// traverse reusable timeouts
        // 		if (timeouts[i].until !== 0)
        // 			throw new Error('Active timeout found after reusable timeouts')
        // }
        const rAF = self.requestAnimationFrame ?? (cb => self.setTimeout(cb, 10));
        process();
        function process() {
            const now = Date.now();
            let firstRealTimeoutIndex;
            let cbsToRun = [];
            for (let i = timeouts.length - 1; i >= 0; i--) {
                if (Date.now() - now > 10)
                    // prevent blocking the main thread for too long
                    break;
                const timeout = timeouts[i];
                if (timeout.until === 0)
                    // timeouts with until = 0 are held for reuse
                    continue;
                if (timeout.until > now) {
                    firstRealTimeoutIndex ??= i;
                    continue;
                }
                // this timeout is ready to run
                cbsToRun ??= [];
                cbsToRun.push(timeout.cb);
                firstRealTimeoutIndex = unuseTimeout(i, firstRealTimeoutIndex);
            }
            for (const cb of cbsToRun)
                try {
                    cb();
                }
                catch (e) {
                    console.error('Error in Timeout callback:', e);
                }
            rAF(process);
        }
        function unuseTimeout(index, firstRealTimeoutIndex) {
            const timeout = timeouts[index];
            timeout.id = 0;
            timeout.until = 0;
            timeout.cb = undefined;
            if (firstRealTimeoutIndex === undefined) {
                // if it's undefined, this *was* the first real timeout, so no point in moving it
                // validateTimeouts()
                return index - 1;
            }
            // swap with firstRealTimeoutIndex
            timeouts[index] = timeouts[firstRealTimeoutIndex];
            timeouts[firstRealTimeoutIndex] = timeout;
            // validateTimeouts()
            // move firstRealTimeoutIndex forward since it's pointing to a completed timeout now
            return firstRealTimeoutIndex - 1;
        }
        let nextTimeoutId = 1;
        function set(cb, ms) {
            for (const timeout of timeouts) {
                if (timeout.until !== 0)
                    continue;
                // completed timeout object, reuse it
                timeout.id = nextTimeoutId++;
                timeout.until = Date.now() + ms;
                timeout.cb = cb;
                // validateTimeouts()
                return timeout.id;
            }
            const timeout = {
                id: nextTimeoutId++,
                until: Date.now() + ms,
                cb,
            };
            timeouts.unshift(timeout);
            // validateTimeouts()
            return timeout.id;
        }
        Timeout.set = set;
        function clear(id) {
            if (!id || !(id > 0))
                return;
            let firstRealTimeoutIndex;
            for (let i = timeouts.length - 1; i >= 0; i--) {
                const timeout = timeouts[i];
                if (timeout.until === 0)
                    continue;
                firstRealTimeoutIndex ??= i;
                if (timeout.id !== id)
                    continue;
                // found it, mark as completed
                firstRealTimeoutIndex = unuseTimeout(i, firstRealTimeoutIndex);
            }
        }
        Timeout.clear = clear;
    })(Timeout || (Timeout = {}));
    exports.default = Timeout;
});
define("kitsui/utility/State", ["require", "exports", "kitsui/utility/Arrays", "kitsui/utility/Functions", "kitsui/utility/Objects", "kitsui/utility/Timeout"], function (require, exports, Arrays_1, Functions_1, Objects_1, Timeout_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Arrays_1 = __importStar(Arrays_1);
    Functions_1 = __importDefault(Functions_1);
    Timeout_1 = __importDefault(Timeout_1);
    // const SYMBOL_UNSUBSCRIBE = Symbol('UNSUBSCRIBE')
    // interface SubscriberFunction<T> {
    // 	(value: T, oldValue: T): unknown
    // 	[SYMBOL_UNSUBSCRIBE]?: Set<() => void>
    // }
    const SYMBOL_VALUE = Symbol('VALUE');
    const SYMBOL_SUBSCRIBERS = Symbol('SUBSCRIBERS');
    function State(defaultValue, comparator) {
        let unuseBoundState;
        let equalsMap;
        const result = {
            isState: true,
            setId(id) {
                result.id = id;
                return result;
            },
            [SYMBOL_VALUE]: defaultValue,
            [SYMBOL_SUBSCRIBERS]: [],
            get value() {
                return result[SYMBOL_VALUE];
            },
            set value(value) {
                unuseBoundState?.();
                setValue(value);
            },
            setValue(value) {
                unuseBoundState?.();
                setValue(value);
                return result;
            },
            comparator: value => comparator === false ? false
                : result[SYMBOL_VALUE] === value || comparator?.(result[SYMBOL_VALUE], value) || false,
            emit: oldValue => {
                if (result.id !== undefined)
                    console.log('emit', result.id);
                for (const subscriber of result[SYMBOL_SUBSCRIBERS].slice())
                    subscriber(result[SYMBOL_VALUE], oldValue);
                return result;
            },
            bind(owner, state) {
                if (state.id)
                    console.log('bind', state.id);
                unuseBoundState?.();
                unuseBoundState = state.use(owner, setValue);
                return unuseBoundState;
            },
            bindManual(state) {
                if (state.id)
                    console.log('bind', state.id);
                unuseBoundState?.();
                unuseBoundState = state.useManual(setValue);
                return unuseBoundState;
            },
            use: (owner, subscriber) => {
                let subOwner;
                result.subscribe(owner, executeSubscriber);
                executeSubscriber(result[SYMBOL_VALUE], undefined);
                return () => result.unsubscribe(executeSubscriber);
                function executeSubscriber(value, oldValue) {
                    subOwner?.remove();
                    subOwner = State.Owner.create();
                    subscriber(value, oldValue, subOwner);
                }
            },
            useManual: subscriber => {
                let subOwner;
                result.subscribeManual(executeSubscriber);
                executeSubscriber(result[SYMBOL_VALUE], undefined);
                return () => result.unsubscribe(executeSubscriber);
                function executeSubscriber(value, oldValue) {
                    subOwner?.remove();
                    subOwner = State.Owner.create();
                    subscriber(value, oldValue, subOwner);
                }
            },
            subscribe: (owner, subscriber) => {
                const ownerClosedState = State.Owner.getRemovedState(owner);
                if (!ownerClosedState || ownerClosedState.value)
                    return Functions_1.default.NO_OP;
                function cleanup() {
                    ownerClosedState.unsubscribe(cleanup);
                    result.unsubscribe(subscriber);
                    // fn[SYMBOL_UNSUBSCRIBE]?.delete(cleanup)
                }
                State.OwnerMetadata.setHasSubscriptions(owner);
                // const fn = subscriber as SubscriberFunction<T>
                // fn[SYMBOL_UNSUBSCRIBE] ??= new Set()
                // fn[SYMBOL_UNSUBSCRIBE].add(cleanup)
                ownerClosedState.subscribeManual(cleanup);
                result.subscribeManual(subscriber);
                return cleanup;
            },
            subscribeManual: subscriber => {
                result[SYMBOL_SUBSCRIBERS].push(subscriber);
                checkTooMany();
                return () => result.unsubscribe(subscriber);
            },
            unsubscribe: subscriber => {
                Arrays_1.default.filterInPlace(result[SYMBOL_SUBSCRIBERS], s => s !== subscriber);
                return result;
            },
            match(owner, values, then) {
                return result.use(owner, function awaitValue(newValue) {
                    if (newValue !== values && (!Array.isArray(values) || !values.includes(newValue)))
                        return;
                    result.unsubscribe(awaitValue);
                    then(newValue);
                });
            },
            matchManual(values, then) {
                return result.useManual(function awaitValue(newValue) {
                    if (newValue !== values && (!Array.isArray(values) || !values.includes(newValue)))
                        return;
                    result.unsubscribe(awaitValue);
                    then(newValue);
                });
            },
            await(owner, value) {
                return new Promise(resolve => result.match(owner, value, () => { resolve(result.value); }));
            },
            map: (owner, mapper, equals) => State.Map(owner, [result], mapper, equals),
            mapManual: (mapper, equals) => State.MapManual([result], mapper, equals),
            get nonNullish() {
                return (0, Objects_1.DefineProperty)(result, 'nonNullish', State
                    .Generator(() => result.value !== undefined && result.value !== null)
                    .observeManual(result));
            },
            get truthy() {
                return (0, Objects_1.DefineProperty)(result, 'truthy', State
                    .Generator(() => !!result.value)
                    .observeManual(result));
            },
            get not() {
                return getNot();
            },
            get falsy() {
                return getNot();
            },
            equals(value) {
                equalsMap ??= new Map();
                let equalsResult = equalsMap.get(value);
                if (equalsResult === undefined)
                    equalsMap.set(value, equalsResult = State.Generator(() => result.value === value).observeManual(result));
                return equalsResult;
            },
            notEquals(value) {
                return result.equals(value).not;
            },
            coalesce(right) {
                const rightState = State.get(right);
                return State.Generator(() => {
                    const leftValue = result.value;
                    if (leftValue !== undefined && leftValue !== null)
                        return leftValue;
                    return rightState.value;
                }).observeManual(result, rightState);
            },
            delay(owner, delay, mapper, equals) {
                const delayedResult = State(!mapper ? result.value : mapper(result.value), equals);
                let timeout;
                const isCurrentlyDelayed = State(false);
                result.subscribe(owner, value => {
                    Timeout_1.default.clear(timeout);
                    const ms = Functions_1.default.resolve(delay, value);
                    if (!ms) {
                        isCurrentlyDelayed.value = false;
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        return delayedResult.value = !mapper ? value : mapper(value);
                    }
                    isCurrentlyDelayed.value = true;
                    timeout = Timeout_1.default.set(() => {
                        isCurrentlyDelayed.value = false;
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        delayedResult.value = !mapper ? value : mapper(value);
                    }, ms);
                });
                return Object.assign(delayedResult, {
                    delayed: isCurrentlyDelayed,
                });
            },
        };
        result.asMutable = result;
        let loggedTooMany = false;
        return result; // Objects.stringify.disable(result)
        function setValue(value) {
            if (comparator !== false && (result[SYMBOL_VALUE] === value || comparator?.(result[SYMBOL_VALUE], value)))
                return;
            const oldValue = result[SYMBOL_VALUE];
            result[SYMBOL_VALUE] = value;
            result.emit(oldValue);
        }
        function getNot() {
            const not = State
                .Generator(() => !result.value)
                .observeManual(result);
            (0, Objects_1.DefineProperty)(result, 'not', not);
            (0, Objects_1.DefineProperty)(result, 'falsy', not);
            return not;
        }
        function checkTooMany() {
            if (!loggedTooMany && result[SYMBOL_SUBSCRIBERS].length > 1000) {
                loggedTooMany = true;
                console.warn('State has over 1000 subscribers! Potential memory leak?', result);
            }
        }
    }
    (function (State) {
        let Owner;
        (function (Owner) {
            function getRemovedState(ownerIn) {
                const state = ownerIn?.removed;
                if (is(state))
                    return state;
                return undefined;
            }
            Owner.getRemovedState = getRemovedState;
            function getCombined(...owners) {
                const combinedOwner = create();
                for (const owner of owners)
                    owner.removed.match(combinedOwner, true, () => combinedOwner.remove());
                return combinedOwner;
            }
            Owner.getCombined = getCombined;
            function create() {
                const removed = State(false);
                return {
                    removed,
                    remove: () => removed.value = true,
                };
            }
            Owner.create = create;
            function fromSignal(signal) {
                const owner = create();
                signal.addEventListener('abort', owner.remove);
                return owner;
            }
            Owner.fromSignal = fromSignal;
        })(Owner = State.Owner || (State.Owner = {}));
        function is(value) {
            return typeof value === 'object' && value?.isState === true;
        }
        State.is = is;
        function get(value) {
            return is(value) ? value : State(value);
        }
        State.get = get;
        function Mutable(owner, value) {
            if (!is(value))
                return State(value);
            const state = State(undefined);
            state.bind(owner, value);
            return state;
        }
        State.Mutable = Mutable;
        function value(state) {
            return is(state) ? state.value : state;
        }
        State.value = value;
        function getInternalValue(state) {
            return is(state) ? state[SYMBOL_VALUE] : state;
        }
        State.getInternalValue = getInternalValue;
        const SYMBOL_HAS_SUBSCRIPTIONS = Symbol('HAS_SUBSCRIPTIONS');
        let OwnerMetadata;
        (function (OwnerMetadata) {
            function setHasSubscriptions(owner) {
                owner[SYMBOL_HAS_SUBSCRIPTIONS] = true;
            }
            OwnerMetadata.setHasSubscriptions = setHasSubscriptions;
            function hasSubscriptions(owner) {
                return owner[SYMBOL_HAS_SUBSCRIPTIONS] === true;
            }
            OwnerMetadata.hasSubscriptions = hasSubscriptions;
        })(OwnerMetadata = State.OwnerMetadata || (State.OwnerMetadata = {}));
        function Generator(generate, equals) {
            const result = State(undefined, equals);
            delete result.asMutable;
            (0, Objects_1.DefineMagic)(result, 'value', {
                get: () => result[SYMBOL_VALUE],
            });
            let initial = true;
            let unuseInternalState;
            result.refresh = () => refreshInternal();
            result.regenerate = () => refreshInternal(true);
            result.refresh();
            result.observe = (owner, ...states) => {
                const ownerClosedState = Owner.getRemovedState(owner);
                if (!ownerClosedState || ownerClosedState.value)
                    return result;
                OwnerMetadata.setHasSubscriptions(owner);
                for (const state of states)
                    state?.subscribeManual(result.refresh);
                let unuseOwnerRemove = ownerClosedState.subscribeManual(removed => removed && onRemove());
                return result;
                function onRemove() {
                    unuseOwnerRemove?.();
                    unuseOwnerRemove = undefined;
                    for (const state of states)
                        state?.unsubscribe(result.refresh);
                }
            };
            result.observeManual = (...states) => {
                for (const state of states)
                    state?.subscribeManual(result.refresh);
                return result;
            };
            result.unobserve = (...states) => {
                for (const state of states)
                    state?.unsubscribe(result.refresh);
                return result;
            };
            return result;
            function refreshInternal(forceOverwrite) {
                unuseInternalState?.();
                unuseInternalState = undefined;
                const value = generate();
                if (State.is(value)) {
                    unuseInternalState = value.useManual(value => {
                        if (result.comparator(value))
                            return result;
                        const oldValue = result[SYMBOL_VALUE];
                        result[SYMBOL_VALUE] = value;
                        result.emit(oldValue);
                    });
                    return result;
                }
                if (result.comparator(value) && !initial && !forceOverwrite)
                    return result;
                initial = false;
                const oldValue = result[SYMBOL_VALUE];
                result[SYMBOL_VALUE] = value;
                result.emit(oldValue);
                return result;
            }
        }
        State.Generator = Generator;
        function JIT(generate) {
            const result = State(undefined);
            delete result.asMutable;
            let isCached = false;
            let cached;
            let unuseInternalState;
            let owner;
            (0, Objects_1.DefineMagic)(result, 'value', {
                get: () => {
                    if (!isCached) {
                        unuseInternalState?.();
                        unuseInternalState = undefined;
                        owner?.remove();
                        owner = undefined;
                        isCached = true;
                        owner = Owner.create();
                        const result = generate(owner);
                        if (State.is(result))
                            unuseInternalState = result.useManual(value => cached = value);
                        else
                            cached = result;
                    }
                    return cached;
                },
            });
            const get = () => result.value;
            result.emit = () => {
                for (const subscriber of result[SYMBOL_SUBSCRIBERS].slice())
                    subscriber(get, cached);
                return result;
            };
            result.use = (owner, subscriber) => {
                let subOwner;
                result.subscribe(owner, executeSubscriber);
                executeSubscriber(get, undefined);
                return () => result.unsubscribe(executeSubscriber);
                function executeSubscriber(value, oldValue) {
                    subOwner?.remove();
                    subOwner = State.Owner.create();
                    subscriber(value, oldValue, subOwner);
                }
            };
            result.useManual = subscriber => {
                let subOwner;
                result.subscribeManual(executeSubscriber);
                executeSubscriber(get, undefined);
                return () => result.unsubscribe(executeSubscriber);
                function executeSubscriber(value, oldValue) {
                    subOwner?.remove();
                    subOwner = State.Owner.create();
                    subscriber(value, oldValue, subOwner);
                }
            };
            result.markDirty = () => {
                unuseInternalState?.();
                unuseInternalState = undefined;
                owner?.remove();
                owner = undefined;
                const oldValue = cached;
                isCached = false;
                cached = undefined;
                result.emit(oldValue);
                return result;
            };
            result.observe = (...states) => {
                for (const state of states)
                    state.subscribeManual(result.markDirty);
                return result;
            };
            result.unobserve = (...states) => {
                for (const state of states)
                    state.unsubscribe(result.markDirty);
                return result;
            };
            return result;
        }
        State.JIT = JIT;
        function Async(...args) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return State.Owner.getRemovedState(args[0])
                ? createAsyncState(...args)
                : createAsyncState(State.Owner.create(), ...args);
        }
        State.Async = Async;
        function createAsyncState(owner, _from, _generator) {
            const from = State.is(_from) ? _from : State(null);
            const generator = State.is(_from) ? _generator : (_, signal, setProgress) => _from(signal, setProgress);
            const state = State({
                settled: false,
                value: undefined,
                lastValue: undefined,
                error: undefined,
                progress: undefined,
            });
            const settled = state.mapManual(state => state.settled);
            const error = state.mapManual(state => state.error);
            const value = state.mapManual(state => state.value);
            const lastValue = state.mapManual(state => state.lastValue);
            const progress = state.mapManual(state => state.progress);
            let abortController;
            let promise;
            from.use(owner, from => {
                abortController?.abort();
                const lastValue = state.value.value;
                state.value = {
                    settled: false,
                    value: undefined,
                    lastValue,
                    error: undefined,
                    progress: undefined,
                };
                abortController = new AbortController();
                // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
                promise = new Promise(async (resolve, reject) => {
                    const promise = Promise.resolve(generator(from, abortController.signal, (progress, details) => {
                        (0, Objects_1.mutable)(state.value).progress = { progress, details };
                        state.emit();
                    }));
                    const { value, error } = await promise.then(value => ({ value, error: undefined }), error => ({ error: new Error('Async state rejection:', { cause: error }), value: undefined }));
                    promise.then(resolve, reject);
                    if (abortController?.signal.aborted)
                        return;
                    state.value = {
                        settled: true,
                        value,
                        lastValue,
                        error,
                        progress: undefined,
                    };
                });
            });
            const result = Object.assign(value, {
                settled,
                lastValue,
                error,
                state,
                progress,
                refresh() {
                    from.emit();
                },
            });
            Object.defineProperty(result, 'promise', {
                get: () => promise,
            });
            return result;
        }
        function Array(...values) {
            const itemStates = [];
            const subscribers = [];
            const state = Object.assign(State(values), {
                length: undefined,
                set(index, value) {
                    values[index] = value;
                    const itemState = itemStates[index];
                    itemState.value.value = value;
                    itemState.emit();
                    state.emit();
                    return state;
                },
                emitItem(index) {
                    itemStates[index]?.emit();
                    return state;
                },
                modify(index, modifier) {
                    let value = values[index];
                    value = modifier(value, index, state) ?? value;
                    state.set(index, value);
                    return state;
                },
                clear() {
                    values.length = 0;
                    itemStates.length = 0;
                    state.emit();
                    return state;
                },
                push(...newValues) {
                    const start = state.value.length;
                    values.push(...newValues);
                    for (let i = 0; i < newValues.length; i++)
                        itemStates.push(addState(newValues[i], start + i));
                    state.emit();
                    return state;
                },
                unshift(...newValues) {
                    values.unshift(...newValues);
                    for (let i = 0; i < newValues.length; i++)
                        itemStates.unshift(addState(newValues[i], i));
                    for (let i = newValues.length; i < itemStates.length; i++)
                        itemStates[i].value.index = i;
                    for (let i = newValues.length; i < itemStates.length; i++)
                        itemStates[i].emit();
                    state.emit();
                    return state;
                },
                pop() {
                    values.pop();
                    itemStates.pop();
                    state.emit();
                    return state;
                },
                shift() {
                    values.shift();
                    itemStates.shift();
                    for (let i = 0; i < itemStates.length; i++)
                        itemStates[i].value.index = i;
                    for (const itemState of itemStates)
                        itemState.emit();
                    state.emit();
                    return state;
                },
                splice(start, deleteCount, ...newValues) {
                    values.splice(start, deleteCount, ...newValues);
                    itemStates.splice(start, deleteCount, ...newValues
                        .map((value, i) => addState(value, start + i)));
                    for (let i = start + newValues.length; i < itemStates.length; i++)
                        itemStates[i].value.index = i;
                    for (let i = start + newValues.length; i < itemStates.length; i++)
                        itemStates[i].emit();
                    state.emit();
                    return state;
                },
                filterInPlace(predicate) {
                    Arrays_1.default.filterInPlace(values, predicate);
                    let oldStatesI = 0;
                    NextValue: for (let i = 0; i < values.length; i++) {
                        while (oldStatesI < itemStates.length) {
                            if (itemStates[oldStatesI].value.value !== values[i]) {
                                itemStates[oldStatesI].value.removed.asMutable?.setValue(true);
                                oldStatesI++;
                                continue;
                            }
                            itemStates[i] = itemStates[oldStatesI];
                            itemStates[i].value.index = i;
                            oldStatesI++;
                            continue NextValue;
                        }
                    }
                    // clip off the states that were pulled back or not included
                    for (let i = oldStatesI; i < itemStates.length; i++)
                        itemStates[i].value.removed.asMutable?.setValue(true);
                    itemStates.length = values.length;
                    for (const itemState of itemStates)
                        itemState.emit();
                    state.emit();
                    return state;
                },
                move(startIndex, endIndex, newStartIndex) {
                    startIndex = Math.max(0, startIndex);
                    endIndex = Math.min(endIndex, values.length);
                    newStartIndex = Math.max(0, Math.min(newStartIndex, values.length));
                    if (startIndex >= endIndex)
                        return state;
                    if (newStartIndex >= startIndex && newStartIndex < endIndex)
                        // if the slice is moved to a new position within itself, do nothing
                        return state;
                    const valuesToMove = values.splice(startIndex, endIndex - startIndex);
                    const statesToMove = itemStates.splice(startIndex, endIndex - startIndex);
                    const actualInsertionIndex = startIndex < newStartIndex
                        ? newStartIndex - (endIndex - startIndex) + 1 // account for spliced out indices
                        : newStartIndex;
                    values.splice(actualInsertionIndex, 0, ...valuesToMove);
                    itemStates.splice(actualInsertionIndex, 0, ...statesToMove);
                    const emitIndices = [];
                    for (let i = 0; i < itemStates.length; i++) {
                        const savedIndex = itemStates[i].value.index;
                        if (savedIndex !== i) {
                            itemStates[i].value.index = i;
                            emitIndices.push(i);
                        }
                    }
                    for (const index of emitIndices)
                        itemStates[index]?.emit();
                    for (const subscriber of subscribers)
                        subscriber.onMove(startIndex, endIndex, newStartIndex);
                    state.emit();
                    return state;
                },
                moveAt(movingIndices, newStartIndex) {
                    if (!movingIndices.length)
                        return state;
                    const length = values.length;
                    movingIndices = movingIndices.map(i => Math.max(0, Math.min(length - 1, i)));
                    Arrays_1.default.distinctInPlace(movingIndices);
                    movingIndices.sort((a, b) => a - b);
                    newStartIndex = Math.min(newStartIndex, length - movingIndices.length);
                    let staticReadIndex = 0;
                    let movingReadIndex = 0;
                    let writeIndex = 0;
                    let movedCount = 0;
                    const sourceValues = values.slice();
                    const sourceItems = itemStates.slice();
                    let mode;
                    while (writeIndex < length) {
                        mode = writeIndex >= newStartIndex && movedCount < movingIndices.length ? 'moving' : 'static';
                        if (mode === 'static') {
                            for (let i = staticReadIndex; i < length; i++)
                                if (!movingIndices.includes(i)) {
                                    staticReadIndex = i;
                                    break;
                                }
                            values[writeIndex] = sourceValues[staticReadIndex];
                            itemStates[writeIndex] = sourceItems[staticReadIndex];
                            staticReadIndex++;
                            writeIndex++;
                        }
                        else {
                            values[writeIndex] = sourceValues[movingIndices[movingReadIndex]];
                            itemStates[writeIndex] = sourceItems[movingIndices[movingReadIndex]];
                            movingReadIndex++;
                            movedCount++;
                            writeIndex++;
                        }
                    }
                    const emitIndices = [];
                    for (let i = 0; i < itemStates.length; i++) {
                        const savedIndex = itemStates[i].value.index;
                        if (savedIndex !== i) {
                            itemStates[i].value.index = i;
                            emitIndices.push(i);
                        }
                    }
                    for (const index of emitIndices)
                        itemStates[index]?.emit();
                    for (const subscriber of subscribers)
                        subscriber.onMoveAt(movingIndices, newStartIndex);
                    state.emit();
                    return state;
                },
                useEach(owner, subscriber) {
                    const ownerClosedState = State.Owner.getRemovedState(owner);
                    if (!ownerClosedState || ownerClosedState.value)
                        return Functions_1.default.NO_OP;
                    for (const itemState of itemStates)
                        subscriber.onItem(itemState, state);
                    State.OwnerMetadata.setHasSubscriptions(owner);
                    // const fn = subscriber as SubscriberFunction<T>
                    // fn[SYMBOL_UNSUBSCRIBE] ??= new Set()
                    // fn[SYMBOL_UNSUBSCRIBE].add(cleanup)
                    ownerClosedState.subscribeManual(cleanup);
                    subscribers.push(subscriber);
                    return cleanup;
                    function cleanup() {
                        ownerClosedState.unsubscribe(cleanup);
                        Arrays_1.default.filterInPlace(subscribers, s => s !== subscriber);
                        // fn[SYMBOL_UNSUBSCRIBE]?.delete(cleanup)
                    }
                },
            });
            (0, Objects_1.mutable)(state).length = state.mapManual(state => state.length);
            return state;
            function addState(value, index) {
                const itemState = State({ value, index, removed: State(false) });
                for (const subscriber of subscribers)
                    subscriber.onItem(itemState, state);
                return itemState;
            }
        }
        State.Array = Array;
        function Truthy(owner, state) {
            return Generator(() => !!state.value)
                .observe(owner, state);
        }
        State.Truthy = Truthy;
        function NonNullish(owner, state) {
            return Generator(() => state.value !== undefined && state.value !== null)
                .observe(owner, state);
        }
        State.NonNullish = NonNullish;
        function Falsy(owner, state) {
            return Generator(() => !!state.value)
                .observe(owner, state);
        }
        State.Falsy = Falsy;
        function Some(owner, ...anyOfStates) {
            return Generator(() => anyOfStates.some(state => state.value))
                .observe(owner, ...anyOfStates);
        }
        State.Some = Some;
        function Every(owner, ...anyOfStates) {
            return Generator(() => anyOfStates.every(state => state.value))
                .observe(owner, ...anyOfStates);
        }
        State.Every = Every;
        function Map(owner, inputs, outputGenerator, equals) {
            return Generator(() => outputGenerator(...inputs.map(input => input?.value)), equals)
                .observe(owner, ...inputs.filter(Arrays_1.NonNullish));
        }
        State.Map = Map;
        function MapManual(inputs, outputGenerator, equals) {
            return Generator(() => outputGenerator(...inputs.map(input => input?.value)), equals)
                .observeManual(...inputs.filter(Arrays_1.NonNullish));
        }
        State.MapManual = MapManual;
        function Delayed(owner, input, delay) {
            return Use(owner, input).delay(owner, delay ?? 10);
        }
        State.Delayed = Delayed;
        function Use(owner, input, userIn) {
            const user = userIn;
            const toObserve = Object.values(input).filter(Arrays_1.NonNullish);
            const gen = Generator(() => Object.fromEntries(Object.entries(input).map(([key, state]) => [key, state?.value])))
                .observe(owner, ...toObserve);
            if (!user)
                return gen;
            const unsub = gen.use(owner, user);
            return () => {
                unsub();
                gen.unobserve(...toObserve);
            };
        }
        State.Use = Use;
        function UseManual(input, userIn) {
            const user = userIn;
            const toObserve = Object.values(input).filter(Arrays_1.NonNullish);
            const gen = Generator(() => Object.fromEntries(Object.entries(input).map(([key, state]) => [key, state?.value])))
                .observeManual(...toObserve);
            if (!user)
                return gen;
            const unsub = gen.useManual(user);
            return () => {
                unsub();
                gen.unobserve(...toObserve);
            };
        }
        State.UseManual = UseManual;
    })(State || (State = {}));
    exports.default = State;
});
define("kitsui/component/Label", ["require", "exports", "kitsui/Component", "kitsui/utility/State"], function (require, exports, Component_1, State_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LabelTarget = void 0;
    Component_1 = __importDefault(Component_1);
    State_1 = __importDefault(State_1);
    var LabelStyleTargets;
    (function (LabelStyleTargets) {
        LabelStyleTargets[LabelStyleTargets["Label"] = 0] = "Label";
    })(LabelStyleTargets || (LabelStyleTargets = {}));
    const Label = (0, Component_1.default)('label', (label) => {
        const textWrapper = (0, Component_1.default)()
            .appendTo(label);
        let requiredOwner;
        let unuseTarget;
        return label
            .addStyleTargets(LabelStyleTargets)
            .extend(label => ({
            textWrapper,
            for: (0, State_1.default)(undefined),
            required: (0, State_1.default)(false),
            invalid: (0, State_1.default)(false),
            setFor: inputName => {
                label.attributes.set('for', inputName);
                label.for.asMutable?.setValue(inputName);
                return label;
            },
            setRequired: (required = true) => {
                requiredOwner?.remove();
                requiredOwner = undefined;
                if (typeof required === 'boolean')
                    label.required.value = required;
                else {
                    requiredOwner = State_1.default.Owner.create();
                    label.required.bind(requiredOwner, required);
                }
                return label;
            },
            setTarget: target => {
                unuseTarget?.();
                unuseTarget = undefined;
                label.setFor(target?.name.value);
                label.setRequired(target?.required);
                const targetInvalidOwner = State_1.default.Owner.create();
                if (target?.invalid)
                    State_1.default.Use(targetInvalidOwner, { invalid: target.invalid, touched: target.touched })
                        .use(targetInvalidOwner, ({ invalid, touched }) => label.invalid.asMutable?.setValue(!!invalid && (touched ?? true)));
                unuseTarget = !target ? undefined : () => {
                    targetInvalidOwner.remove();
                    unuseTarget = undefined;
                };
                return label;
            },
        }))
            .extendJIT('text', label => label.textWrapper.text.rehost(label))
            .onRooted(label => {
            label.for.subscribeManual(inputName => label.setFor(inputName));
            label.required.subscribeManual(required => {
                if (requiredOwner)
                    return; // don't recursively setRequired when required is bound to another state
                label.setRequired(required);
            });
        })
            .onRemoveManual(() => {
            requiredOwner?.remove();
        });
    });
    exports.default = Label;
    exports.LabelTarget = Component_1.default.Extension(component => {
        return component;
    });
});
define("kitsui/utility/Vector2", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function Vector2(x = 0, y) {
        if (y === undefined)
            y = x;
        return { x, y };
    }
    (function (Vector2) {
        ////////////////////////////////////
        //#region Constructors
        Vector2.ZERO = { x: 0, y: 0 };
        Vector2.ONE = { x: 1, y: 1 };
        function mutable(x = 0, y) {
            if (y === undefined)
                y = x;
            return { x, y };
        }
        Vector2.mutable = mutable;
        function fromClient(clientSource) {
            return { x: clientSource.clientX, y: clientSource.clientY };
        }
        Vector2.fromClient = fromClient;
        //#endregion
        ////////////////////////////////////
        function equals(v1, v2) {
            return v1.x === v2.x && v1.y === v2.y;
        }
        Vector2.equals = equals;
        function distance(v1, v2) {
            return Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2);
        }
        Vector2.distance = distance;
        function distanceWithin(within, v1, v2) {
            return (v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2 < within ** 2;
        }
        Vector2.distanceWithin = distanceWithin;
        function add(v1, v2) {
            return { x: v1.x + v2.x, y: v1.y + v2.y };
        }
        Vector2.add = add;
        function addInPlace(v1, v2) {
            v1.x += v2.x;
            v1.y += v2.y;
            return v1;
        }
        Vector2.addInPlace = addInPlace;
        function subtract(v1, v2) {
            return { x: v1.x - v2.x, y: v1.y - v2.y };
        }
        Vector2.subtract = subtract;
        function subtractInPlace(v1, v2) {
            v1.x -= v2.x;
            v1.y -= v2.y;
            return v1;
        }
        Vector2.subtractInPlace = subtractInPlace;
        function multiply(v, scalar) {
            return { x: v.x * scalar, y: v.y * scalar };
        }
        Vector2.multiply = multiply;
        function multiplyInPlace(v, scalar) {
            v.x *= scalar;
            v.y *= scalar;
            return v;
        }
        Vector2.multiplyInPlace = multiplyInPlace;
        function divide(v, scalar) {
            return { x: v.x / scalar, y: v.y / scalar };
        }
        Vector2.divide = divide;
        function divideInPlace(v, scalar) {
            v.x /= scalar;
            v.y /= scalar;
            return v;
        }
        Vector2.divideInPlace = divideInPlace;
        function modTruncate(v, scalar) {
            return { x: v.x % scalar, y: v.y % scalar };
        }
        Vector2.modTruncate = modTruncate;
        function modTruncateInPlace(v, scalar) {
            v.x %= scalar;
            v.y %= scalar;
            return v;
        }
        Vector2.modTruncateInPlace = modTruncateInPlace;
        function modFloor(v, scalar) {
            return {
                x: (v.x % scalar + scalar) % scalar,
                y: (v.y % scalar + scalar) % scalar,
            };
        }
        Vector2.modFloor = modFloor;
        function modFloorInPlace(v, scalar) {
            v.x = (v.x % scalar + scalar) % scalar;
            v.y = (v.y % scalar + scalar) % scalar;
            return v;
        }
        Vector2.modFloorInPlace = modFloorInPlace;
        function dot(v1, v2) {
            return v1.x * v2.x + v1.y * v2.y;
        }
        Vector2.dot = dot;
        /** IE, distance from 0,0 */
        function magnitude(v) {
            return Math.sqrt(v.x ** 2 + v.y ** 2);
        }
        Vector2.magnitude = magnitude;
        function normalise(v) {
            const magnitude = Vector2.magnitude(v);
            return Vector2.divide(v, magnitude);
        }
        Vector2.normalise = normalise;
        function normaliseInPlace(v) {
            const magnitude = Vector2.magnitude(v);
            return Vector2.divideInPlace(v, magnitude);
        }
        Vector2.normaliseInPlace = normaliseInPlace;
        function angle(v1, v2) {
            const dot = Vector2.dot(v1, v2);
            const lengths = Vector2.magnitude(v1) * Vector2.magnitude(v2);
            const cosTheta = Math.max(-1, Math.min(1, dot / lengths));
            return Math.acos(cosTheta);
        }
        Vector2.angle = angle;
        function rotate(v, angle) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return {
                x: v.x * cos - v.y * sin,
                y: v.x * sin + v.y * cos,
            };
        }
        Vector2.rotate = rotate;
        function rotateInPlace(v, angle) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const x = v.x;
            v.x = x * cos - v.y * sin;
            v.y = x * sin + v.y * cos;
            return v;
        }
        Vector2.rotateInPlace = rotateInPlace;
        function lerp(v1, v2, t) {
            return {
                x: v1.x + (v2.x - v1.x) * t,
                y: v1.y + (v2.y - v1.y) * t,
            };
        }
        Vector2.lerp = lerp;
        function clamp(v, min, max) {
            return {
                x: Math.min(Math.max(v.x, min.x), max.x),
                y: Math.min(Math.max(v.y, min.y), max.y),
            };
        }
        Vector2.clamp = clamp;
        function clampInPlace(v, min, max) {
            v.x = Math.min(Math.max(v.x, min.x), max.x);
            v.y = Math.min(Math.max(v.y, min.y), max.y);
            return v;
        }
        Vector2.clampInPlace = clampInPlace;
    })(Vector2 || (Vector2 = {}));
    exports.default = Vector2;
});
define("kitsui/utility/Mouse", ["require", "exports", "kitsui/utility/State"], function (require, exports, State_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    State_2 = __importDefault(State_2);
    var Mouse;
    (function (Mouse) {
        const pos = { x: 0, y: 0 };
        Mouse.state = (0, State_2.default)(pos);
        const handlers = new Set();
        function onMove(handler) {
            handlers.add(handler);
        }
        Mouse.onMove = onMove;
        function offMove(handler) {
            handlers.delete(handler);
        }
        Mouse.offMove = offMove;
        function listen() {
            document.addEventListener('mousemove', event => {
                if (pos.x === event.clientX && pos.y === event.clientY)
                    return;
                pos.x = event.clientX;
                pos.y = event.clientY;
                Mouse.state.emit();
                const hovered = [];
                let cursor = event.target;
                while (cursor) {
                    hovered.push(cursor);
                    cursor = cursor.parentElement;
                }
                hovered.reverse();
                for (const handler of handlers)
                    handler(pos, hovered);
            });
        }
        Mouse.listen = listen;
    })(Mouse || (Mouse = {}));
    exports.default = Mouse;
});
define("kitsui/utility/Strings", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Strings;
    (function (Strings) {
        /**
         * Generates a unique string valid for an ID on an element, in the format `_<base 36 timestamp><base 36 random number>`
         * For example: `_m6rpr4mo02bw589br2ze`
         */
        function uid() {
            return `_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
        }
        Strings.uid = uid;
        function simplify(string) {
            return string.toLowerCase()
                .replace(/\W+/g, ' ');
        }
        Strings.simplify = simplify;
        function areSameWords(a, b) {
            return a === undefined || b === undefined ? false
                : simplify(a) === simplify(b);
        }
        Strings.areSameWords = areSameWords;
        function includesAt(string, substring, index) {
            if (index < 0)
                index = string.length + index;
            if (index + substring.length > string.length)
                return false;
            for (let i = 0; i < substring.length; i++)
                if (string[i + index] !== substring[i])
                    return false;
            return true;
        }
        Strings.includesAt = includesAt;
        function splitOnce(string, separator) {
            const index = string.indexOf(separator);
            if (index === -1)
                return [string];
            return [string.slice(0, index), string.slice(index + separator.length)];
        }
        Strings.splitOnce = splitOnce;
        function sliceTo(string, substring, startAt) {
            const index = string.indexOf(substring, startAt);
            if (index === -1)
                return string;
            return string.slice(0, index);
        }
        Strings.sliceTo = sliceTo;
        function sliceAfter(string, substring, startAt) {
            const index = string.indexOf(substring, startAt);
            if (index === -1)
                return string;
            return string.slice(index + substring.length);
        }
        Strings.sliceAfter = sliceAfter;
        function trimTextMatchingFromStart(string, substring, startAt) {
            if (string.length < substring.length)
                return string;
            const index = string.indexOf(substring, startAt);
            if (index !== 0)
                return string;
            return string.slice(index + substring.length);
        }
        Strings.trimTextMatchingFromStart = trimTextMatchingFromStart;
        function trimTextMatchingFromEnd(string, substring, startAt) {
            if (string.length < substring.length)
                return string;
            const index = string.lastIndexOf(substring, startAt);
            if (index !== string.length - substring.length)
                return string;
            return string.slice(0, index);
        }
        Strings.trimTextMatchingFromEnd = trimTextMatchingFromEnd;
        function extractFromQuotes(string) {
            let substring = (string ?? '').trim();
            if (substring[0] === '"')
                substring = substring.slice(1);
            if (substring[substring.length - 1] === '"')
                substring = substring.slice(0, -1);
            return substring.trim();
        }
        Strings.extractFromQuotes = extractFromQuotes;
        function extractFromSquareBrackets(string) {
            let substring = (string ?? '');
            if (substring[0] === '[')
                substring = substring.slice(1).trimStart();
            if (substring[substring.length - 1] === ']')
                substring = substring.slice(0, -1).trimEnd();
            return substring;
        }
        Strings.extractFromSquareBrackets = extractFromSquareBrackets;
        function mergeRegularExpressions(flags, ...expressions) {
            let exprString = '';
            for (const expr of expressions)
                exprString += '|' + expr.source;
            return new RegExp(exprString.slice(1), flags);
        }
        Strings.mergeRegularExpressions = mergeRegularExpressions;
        function count(string, substring, stopAtCount = Infinity) {
            let count = 0;
            let lastIndex = -1;
            while (count < stopAtCount) {
                const index = string.indexOf(substring, lastIndex + 1);
                if (index === -1)
                    return count;
                count++;
                lastIndex = index;
            }
            return count;
        }
        Strings.count = count;
        function includesOnce(string, substring) {
            return count(string, substring, 2) === 1;
        }
        Strings.includesOnce = includesOnce;
        function getVariations(name) {
            const variations = [name];
            variations.push(name + 'd', name + 'ed');
            if (name.endsWith('d'))
                variations.push(...getVariations(name.slice(0, -1)));
            if (name.endsWith('ed'))
                variations.push(...getVariations(name.slice(0, -2)));
            if (name.endsWith('ing')) {
                variations.push(name.slice(0, -3));
                if (name[name.length - 4] === name[name.length - 5])
                    variations.push(name.slice(0, -4));
            }
            else {
                variations.push(name + 'ing', name + name[name.length - 1] + 'ing');
                if (name.endsWith('y'))
                    variations.push(name.slice(0, -1) + 'ing');
            }
            if (name.endsWith('ion')) {
                variations.push(...getVariations(name.slice(0, -3)));
                if (name[name.length - 4] === name[name.length - 5])
                    variations.push(name.slice(0, -4));
            }
            else
                variations.push(name + 'ion');
            if (name.endsWith('er'))
                variations.push(name.slice(0, -1), name.slice(0, -2));
            else {
                variations.push(name + 'r', name + 'er');
                if (name.endsWith('y'))
                    variations.push(name.slice(0, -1) + 'ier');
            }
            if (name.endsWith('ier'))
                variations.push(name.slice(0, -3) + 'y');
            variations.push(name + 's', name + 'es');
            if (name.endsWith('s'))
                variations.push(name.slice(0, -1));
            else {
                if (name.endsWith('y'))
                    variations.push(name.slice(0, -1) + 'ies');
            }
            return variations;
        }
        Strings.getVariations = getVariations;
        function shiftLine(lines, count = 1) {
            for (let i = 0; i < count; i++) {
                const index = lines.indexOf('\n');
                if (index === -1)
                    return lines;
                lines = lines.slice(index + 1);
            }
            return lines;
        }
        Strings.shiftLine = shiftLine;
    })(Strings || (Strings = {}));
    exports.default = Strings;
});
define("kitsui/utility/Time", ["require", "exports", "kitsui/utility/Strings"], function (require, exports, Strings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Strings_1 = __importDefault(Strings_1);
    var Time;
    (function (Time) {
        function floor(interval) {
            return Math.floor(Date.now() / interval) * interval;
        }
        Time.floor = floor;
        Time.frame = seconds(1) / 144;
        function ms(ms) { return ms; }
        Time.ms = ms;
        function seconds(seconds) { return seconds * 1000; }
        Time.seconds = seconds;
        function minutes(minutes) { return minutes * 1000 * 60; }
        Time.minutes = minutes;
        function hours(hours) { return hours * 1000 * 60 * 60; }
        Time.hours = hours;
        function days(days) { return days * 1000 * 60 * 60 * 24; }
        Time.days = days;
        function weeks(weeks) { return weeks * 1000 * 60 * 60 * 24 * 7; }
        Time.weeks = weeks;
        function months(months) { return Math.floor(months * 1000 * 60 * 60 * 24 * (365.2422 / 12)); }
        Time.months = months;
        function years(years) { return Math.floor(years * 1000 * 60 * 60 * 24 * 365.2422); }
        Time.years = years;
        function decades(decades) { return Math.floor(decades * 1000 * 60 * 60 * 24 * 365.2422 * 10); }
        Time.decades = decades;
        function centuries(centuries) { return Math.floor(centuries * 1000 * 60 * 60 * 24 * 365.2422 * 10 * 10); }
        Time.centuries = centuries;
        function millenia(millenia) { return Math.floor(millenia * 1000 * 60 * 60 * 24 * 365.2422 * 10 * 10 * 10); }
        Time.millenia = millenia;
        function relative(unixTimeMs, options = {}) {
            let ms = unixTimeMs - Date.now();
            const locale = navigator.language || 'en-NZ';
            if (!locale.startsWith('en'))
                return relativeIntl(ms, locale, options);
            if (Math.abs(ms) < seconds(1))
                return 'now';
            const ago = ms < 0;
            if (ago)
                ms = Math.abs(ms);
            let limit = options.components ?? Infinity;
            let value = ms;
            let result = !ago && options.label !== false ? 'in ' : '';
            value = Math.floor(ms / years(1));
            ms -= value * years(1);
            if (value && limit-- > 0)
                result += `${value} year${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / months(1));
            ms -= value * months(1);
            if (value && limit-- > 0)
                result += `${value} month${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / weeks(1));
            ms -= value * weeks(1);
            if (value && limit-- > 0)
                result += `${value} week${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / days(1));
            ms -= value * days(1);
            if (value && limit-- > 0)
                result += `${value} day${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / hours(1));
            ms -= value * hours(1);
            if (value && limit-- > 0)
                result += `${value} hour${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / minutes(1));
            ms -= value * minutes(1);
            if (value && limit-- > 0)
                result += `${value} minute${value === 1 ? '' : 's'}${limit > 0 ? ', ' : ''}`;
            value = Math.floor(ms / seconds(1));
            if (value && limit-- > 0 && (!options.secondsExclusive || !result.includes(',')))
                result += `${value} second${value === 1 ? '' : 's'}`;
            result = Strings_1.default.trimTextMatchingFromEnd(result, ', ');
            return `${result}${ago && options.label !== false ? ' ago' : ''}`;
        }
        Time.relative = relative;
        function relativeIntl(ms, locale, options) {
            const rtf = new Intl.RelativeTimeFormat(locale, options);
            let value = ms;
            value = Math.trunc(ms / years(1));
            if (value)
                return rtf.format(value, 'year');
            value = Math.trunc(ms / months(1));
            if (value)
                return rtf.format(value, 'month');
            value = Math.trunc(ms / weeks(1));
            if (value)
                return rtf.format(value, 'week');
            value = Math.trunc(ms / days(1));
            if (value)
                return rtf.format(value, 'day');
            value = Math.trunc(ms / hours(1));
            if (value)
                return rtf.format(value, 'hour');
            value = Math.trunc(ms / minutes(1));
            if (value)
                return rtf.format(value, 'minute');
            value = Math.trunc(ms / seconds(1));
            return rtf.format(value, 'second');
        }
        function absolute(ms, options = { dateStyle: 'full', timeStyle: 'medium' }) {
            const locale = navigator.language || 'en-NZ';
            const rtf = new Intl.DateTimeFormat(locale, options);
            return rtf.format(ms);
        }
        Time.absolute = absolute;
    })(Time || (Time = {}));
    Object.assign(window, { Time });
    exports.default = Time;
});
define("kitsui/utility/Viewport", ["require", "exports", "kitsui/utility/State"], function (require, exports, State_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    State_3 = __importDefault(State_3);
    var Viewport;
    (function (Viewport) {
        Viewport.size = State_3.default.JIT(() => ({ w: window.innerWidth, h: window.innerHeight }));
        Viewport.sizeExcludingScrollbars = State_3.default.JIT(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.clientHeight }));
        Viewport.mobile = State_3.default.JIT(owner => {
            const contentWidth = 800;
            const result = Viewport.size.value.w < contentWidth;
            Viewport.size.subscribe(owner, Viewport.mobile.markDirty);
            return result;
        });
        Viewport.tablet = State_3.default.JIT(owner => {
            const tabletWidth = 1200;
            const result = Viewport.size.value.w < tabletWidth;
            Viewport.size.subscribe(owner, Viewport.tablet.markDirty);
            return result;
        });
        Viewport.laptop = State_3.default.JIT(owner => {
            const laptopWidth = 1600;
            const result = Viewport.size.value.w < laptopWidth;
            Viewport.size.subscribe(owner, Viewport.laptop.markDirty);
            return result;
        });
        Viewport.state = State_3.default.JIT(owner => {
            const result = Viewport.mobile.value ? 'mobile' : Viewport.tablet.value ? 'tablet' : Viewport.laptop.value ? 'laptop' : 'desktop';
            Viewport.mobile.subscribe(owner, Viewport.state.markDirty);
            Viewport.tablet.subscribe(owner, Viewport.state.markDirty);
            Viewport.laptop.subscribe(owner, Viewport.state.markDirty);
            return result;
        });
        function listen() {
            window.addEventListener('resize', () => { Viewport.size.markDirty(); Viewport.sizeExcludingScrollbars.markDirty(); });
        }
        Viewport.listen = listen;
    })(Viewport || (Viewport = {}));
    exports.default = Viewport;
});
define("kitsui/utility/AnchorManipulator", ["require", "exports", "kitsui/utility/Mouse", "kitsui/utility/State", "kitsui/utility/Time", "kitsui/utility/Viewport"], function (require, exports, Mouse_1, State_4, Time_1, Viewport_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AllowXOffscreen = exports.AllowYOffscreen = exports.ANCHOR_LOCATION_ALIGNMENTS = exports.ANCHOR_SIDE_VERTICAL = exports.ANCHOR_SIDE_HORIZONTAL = exports.ANCHOR_TYPES = void 0;
    Mouse_1 = __importDefault(Mouse_1);
    State_4 = __importDefault(State_4);
    Time_1 = __importDefault(Time_1);
    Viewport_1 = __importDefault(Viewport_1);
    ////////////////////////////////////
    //#region Anchor Strings
    exports.ANCHOR_TYPES = ['off', 'aligned'];
    exports.ANCHOR_SIDE_HORIZONTAL = ['left', 'right'];
    exports.ANCHOR_SIDE_VERTICAL = ['top', 'bottom'];
    const anchorStrings = new Set(exports.ANCHOR_TYPES
        .flatMap(type => [exports.ANCHOR_SIDE_HORIZONTAL, exports.ANCHOR_SIDE_VERTICAL]
        .flatMap(sides => sides
        .map(side => `${type} ${side}`)))
        .flatMap(type => [type, `sticky ${type}`]));
    anchorStrings.add('centre');
    anchorStrings.add('sticky centre');
    function isAnchorString(value) {
        if (anchorStrings.has(value)) {
            return true;
        }
        if (typeof value !== 'string') {
            return false;
        }
        const lastSpace = value.lastIndexOf(' ');
        if (lastSpace === -1) {
            return false;
        }
        const simpleAnchorString = value.slice(0, lastSpace);
        if (!anchorStrings.has(simpleAnchorString)) {
            return false;
        }
        const offsetString = value.slice(lastSpace + 1);
        return !isNaN(+offsetString);
    }
    function parseAnchor(anchor) {
        const sticky = anchor.startsWith('sticky');
        if (sticky) {
            anchor = anchor.slice(7);
        }
        const simpleAnchor = anchor;
        if (simpleAnchor === 'centre') {
            return { sticky, type: 'centre', side: 'centre', offset: 0 };
        }
        const [type, side, offset] = simpleAnchor.split(' ');
        return {
            sticky,
            type,
            side,
            offset: offset ? +offset : 0,
        };
    }
    exports.ANCHOR_LOCATION_ALIGNMENTS = ['left', 'centre', 'right'];
    //#endregion
    ////////////////////////////////////
    ////////////////////////////////////
    //#region Implementation
    exports.AllowYOffscreen = { allowYOffscreen: true };
    exports.AllowXOffscreen = { allowXOffscreen: true };
    function AnchorManipulator(host) {
        let locationPreference;
        let refCache;
        const location = (0, State_4.default)(undefined);
        let currentAlignment;
        let from;
        let lastRender = 0;
        let rerenderTimeout;
        const subscribed = [];
        const addSubscription = (use) => use && subscribed.push(use);
        let unuseFrom;
        let applyOwner;
        let renderId = 0;
        let rendered = false;
        const result = {
            state: location,
            isMouse: () => !locationPreference?.length,
            from: component => {
                unuseFrom?.();
                from = component;
                refCache = undefined;
                result.markDirty();
                unuseFrom = from?.removed.useManual(removed => {
                    if (removed) {
                        from = undefined;
                        unuseFrom?.();
                        unuseFrom = undefined;
                    }
                });
                return host;
            },
            reset: () => {
                locationPreference = undefined;
                result.markDirty();
                return host;
            },
            add: (...config) => {
                const options = typeof config[config.length - 1] === 'string' ? undefined
                    : config.pop();
                let [xAnchor, xRefSelector, yAnchor, yRefSelector] = config;
                if (isAnchorString(xRefSelector)) {
                    yRefSelector = yAnchor;
                    yAnchor = xRefSelector;
                    xRefSelector = '*';
                }
                yRefSelector ??= '*';
                locationPreference ??= [];
                locationPreference.push({
                    xAnchor: parseAnchor(xAnchor),
                    xRefSelector,
                    yAnchor: parseAnchor(yAnchor),
                    yRefSelector,
                    options,
                });
                result.markDirty();
                return host;
            },
            orElseHide: () => {
                locationPreference?.push(false);
                return host;
            },
            markDirty: () => {
                const anchoredBox = host.rect.value;
                if (!anchoredBox.width || !anchoredBox.height)
                    return host;
                location.value = undefined;
                if (lastRender) {
                    const timeSinceLastRender = Date.now() - lastRender;
                    if (timeSinceLastRender > Time_1.default.frame)
                        result.apply();
                    else if (rerenderTimeout === undefined)
                        rerenderTimeout = window.setTimeout(result.apply, Time_1.default.frame - timeSinceLastRender);
                }
                return host;
            },
            get: () => {
                if (location.value)
                    return location.value;
                for (const unuse of subscribed)
                    unuse();
                subscribed.length = 0;
                const anchoredBox = host.rect.value;
                if (!anchoredBox.width || !anchoredBox.height) {
                    location.value = undefined;
                    return { x: 0, y: 0, mouse: false };
                }
                if (anchoredBox && locationPreference && from) {
                    for (const preference of locationPreference) {
                        if (!preference)
                            return location.value ??= { mouse: false, x: -10000, y: -10000, padX: false, xPosSide: 'left', yPosSide: 'top' };
                        let alignment = 'left';
                        const xConf = preference.xAnchor;
                        const xRef = resolveAnchorRef(preference.xRefSelector);
                        if (preference.xRefSelector !== '*' && !xRef)
                            continue;
                        const xBox = xRef?.rect.value;
                        addSubscription(xRef?.rect.subscribe(host, result.markDirty));
                        const xRefCentre = (xBox?.left ?? 0) + (xBox?.width ?? Viewport_1.default.size.value.w) / 2;
                        const xRefLeft = xBox?.left ?? xRefCentre;
                        const xRefRight = xBox?.right ?? xRefCentre;
                        let boxLeft, boxRight;
                        switch (xConf.type) {
                            case 'aligned':
                                alignment = xConf.side;
                                if (xConf.side === 'left') {
                                    // this.left = anchor.left
                                    boxLeft = xRefLeft + xConf.offset;
                                    boxRight = boxLeft + anchoredBox.width;
                                }
                                else {
                                    // this.right = anchor.right
                                    boxRight = xRefRight - xConf.offset;
                                    boxLeft = boxRight - anchoredBox.width;
                                }
                                break;
                            case 'off':
                                alignment = xConf.side === 'left' ? 'right' : 'left';
                                if (xConf.side === 'left') {
                                    // this.right = anchor.left
                                    boxRight = xRefLeft - xConf.offset;
                                    boxLeft = boxRight - anchoredBox.width;
                                }
                                else {
                                    // this.left = anchor.right
                                    boxLeft = xRefRight + xConf.offset;
                                    boxRight = boxLeft + anchoredBox.width;
                                }
                                break;
                            case 'centre':
                                boxLeft = xRefCentre - anchoredBox.width / 2;
                                boxRight = boxLeft + anchoredBox.width;
                                alignment = 'centre';
                                break;
                        }
                        if (preference.options?.xValid?.(boxLeft, xBox, anchoredBox) === false)
                            continue;
                        if (anchoredBox.width < Viewport_1.default.size.value.w && !preference.options?.allowXOffscreen) {
                            const isXOffScreen = boxLeft < 0 || boxRight > Viewport_1.default.size.value.w;
                            if (isXOffScreen && !xConf.sticky)
                                continue;
                            if (boxLeft < 0) {
                                boxLeft = 0;
                                boxRight = anchoredBox.width;
                            }
                            else if (boxRight > Viewport_1.default.size.value.w) {
                                boxRight = Viewport_1.default.size.value.w;
                                boxLeft = boxRight - anchoredBox.width;
                            }
                        }
                        const yConf = preference.yAnchor;
                        const yRef = resolveAnchorRef(preference.yRefSelector);
                        if (preference.yRefSelector !== '*' && !yRef)
                            continue;
                        const yBox = yRef?.rect.value;
                        addSubscription(yRef?.rect.subscribe(host, result.markDirty));
                        const yRefCentre = (yBox?.top ?? 0) + (yBox?.height ?? Viewport_1.default.size.value.h) / 2;
                        const yRefTop = yBox?.top ?? yRefCentre;
                        const yRefBottom = yBox?.bottom ?? yRefCentre;
                        let boxTop, boxBottom;
                        switch (yConf.type) {
                            case 'aligned':
                                if (yConf.side === 'top') {
                                    // this.top = anchor.top
                                    boxTop = yRefTop + yConf.offset;
                                    boxBottom = boxTop + anchoredBox.height;
                                }
                                else {
                                    // this.bottom = anchor.bottom
                                    boxBottom = yRefBottom - yConf.offset;
                                    boxTop = boxBottom - anchoredBox.height;
                                }
                                break;
                            case 'off':
                                if (yConf.side === 'top') {
                                    // this.bottom = anchor.top
                                    boxBottom = yRefTop - yConf.offset;
                                    boxTop = boxBottom - anchoredBox.height;
                                }
                                else {
                                    // this.top = anchor.bottom
                                    boxTop = yRefBottom + yConf.offset;
                                    boxBottom = boxTop + anchoredBox.height;
                                }
                                break;
                            case 'centre':
                                boxTop = yRefCentre - anchoredBox.height / 2;
                                boxBottom = boxTop + anchoredBox.height;
                                break;
                        }
                        if (preference.options?.yValid?.(boxTop, yBox, anchoredBox) === false)
                            continue;
                        if (anchoredBox.height < Viewport_1.default.size.value.h && !preference.options?.allowYOffscreen) {
                            const isYOffScreen = boxTop < 0 || boxBottom > Viewport_1.default.size.value.h;
                            if (isYOffScreen && !yConf.sticky)
                                continue;
                            if (boxTop < 0) {
                                boxTop = 0;
                                boxBottom = anchoredBox.height;
                            }
                            else if (boxBottom > Viewport_1.default.size.value.h) {
                                boxBottom = Viewport_1.default.size.value.h;
                                boxTop = boxBottom - anchoredBox.height;
                            }
                        }
                        let finalX, finalY, xPosSide, yPosSide;
                        if ((xConf.type === 'aligned' && xConf.side === 'right') || (xConf.type === 'off' && xConf.side === 'left')) {
                            xPosSide = 'right';
                            finalX = Viewport_1.default.sizeExcludingScrollbars.value.w - boxRight;
                        }
                        else {
                            xPosSide = 'left';
                            finalX = boxLeft;
                        }
                        if ((yConf.type === 'aligned' && yConf.side === 'bottom') || (yConf.type === 'off' && yConf.side === 'top')) {
                            yPosSide = 'bottom';
                            finalY = Viewport_1.default.sizeExcludingScrollbars.value.h - boxBottom;
                        }
                        else {
                            yPosSide = 'top';
                            finalY = boxTop;
                        }
                        return (location.value ??= {
                            mouse: false,
                            padX: xConf.type === 'off',
                            alignment,
                            x: finalX,
                            y: finalY,
                            xPosSide,
                            yPosSide,
                            yRefBox: yBox,
                            xRefBox: xBox,
                            preference,
                        });
                    }
                }
                return location.value ??= { mouse: true, padX: true, ...Mouse_1.default.state.value, xPosSide: 'left', yPosSide: 'top' };
            },
            apply: () => {
                applyOwner?.remove();
                applyOwner = State_4.default.Owner.create();
                const location = result.get();
                let alignment = location.alignment ?? currentAlignment;
                if (location.mouse) {
                    const shouldFlip = currentAlignment === 'centre' || (currentAlignment === 'right' ? location.x < Viewport_1.default.size.value.w / 2 - 200 : location.x > Viewport_1.default.size.value.w / 2 + 200);
                    if (shouldFlip) {
                        alignment = currentAlignment === 'left' ? 'right' : 'left';
                    }
                    Mouse_1.default.onMove(result.markDirty);
                    applyOwner.removed.subscribeManual(removed => removed && Mouse_1.default.offMove(result.markDirty));
                }
                if (currentAlignment !== alignment) {
                    currentAlignment = alignment;
                    // this.surface.classes.removeStartingWith("aligned-")
                    // this.surface.classes.add(`aligned-${this.currentAlignment}`)
                }
                // this.surface.classes.toggle(location.padX, "pad-x")
                host.element.style.left = location.xPosSide === 'left' ? `${location.x}px` : 'auto';
                host.element.style.right = location.xPosSide === 'right' ? `${location.x}px` : 'auto';
                host.element.style.top = location.yPosSide === 'top' ? `${location.y}px` : 'auto';
                host.element.style.bottom = location.yPosSide === 'bottom' ? `${location.y}px` : 'auto';
                host.rect.markDirty();
                if (!rendered) {
                    const id = ++renderId;
                    host.style.setProperty('display', 'none');
                    host.style.setProperty('transition-duration', '0s');
                    void new Promise(resolve => setTimeout(resolve, 50)).then(() => {
                        if (renderId !== id)
                            return;
                        host.style.removeProperties('display', 'transition-duration');
                        rendered = true;
                    });
                }
                rerenderTimeout = undefined;
                lastRender = Date.now();
                return host;
            },
        };
        return result;
        function resolveAnchorRef(selector) {
            const refRef = refCache?.[selector];
            let ref;
            if (refRef) {
                ref = refRef.deref();
            }
            else {
                ref = selector.startsWith('>>')
                    ? from?.element.querySelector(selector.slice(2))?.component
                    : from?.element.closest(selector)?.component;
                if (ref) {
                    if (getComputedStyle(ref.element).display === 'contents') {
                        const children = ref.element.children;
                        if (!children.length)
                            console.warn('Anchor ref has display: contents and no children');
                        else {
                            ref = children[0].component ?? ref;
                            if (children.length > 1)
                                console.warn('Anchor ref has display: contents and multiple children');
                        }
                    }
                    refCache ??= {};
                    refCache[selector] = new WeakRef(ref);
                }
            }
            return ref;
        }
    }
    exports.default = AnchorManipulator;
});
//#endregion
////////////////////////////////////
define("kitsui/utility/Maps", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Maps;
    (function (Maps) {
        function compute(map, key, computer) {
            const value = map.get(key);
            if (value === undefined)
                return computer(key);
            return value;
        }
        Maps.compute = compute;
    })(Maps || (Maps = {}));
    exports.default = Maps;
});
define("kitsui/utility/StringApplicator", ["require", "exports", "kitsui/utility/Arrays", "kitsui/utility/State"], function (require, exports, Arrays_2, State_5) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StringApplicatorSource = void 0;
    State_5 = __importDefault(State_5);
    let cumulativeSourceRequiredState;
    var StringApplicatorSource;
    (function (StringApplicatorSource) {
        StringApplicatorSource.REGISTRY = {};
        function register(source, value) {
            StringApplicatorSource.REGISTRY[source] = value;
            cumulativeSourceRequiredState = State_5.default.MapManual(Object.values(StringApplicatorSource.REGISTRY).map(def => def.requiredState).filter(Arrays_2.NonNullish), () => null, false);
        }
        StringApplicatorSource.register = register;
        function toString(source) {
            // if (typeof source === 'function')
            // 	source = source()
            if (typeof source === 'string')
                return source;
            for (const def of Object.values(StringApplicatorSource.REGISTRY))
                if (def.match(source))
                    return def.toString(source);
            throw new Error(`No StringApplicatorSourceDefinition found for source: ${String(source)}`);
        }
        StringApplicatorSource.toString = toString;
        function toNodes(source) {
            // if (typeof source === 'function')
            // 	source = source()
            if (typeof source === 'string')
                return [document.createTextNode(source)];
            for (const def of Object.values(StringApplicatorSource.REGISTRY))
                if (def.match(source))
                    return def.toNodes(source);
            throw new Error(`No StringApplicatorSourceDefinition found for source: ${String(source)}`);
        }
        StringApplicatorSource.toNodes = toNodes;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        function apply(applicator, source) {
            if (typeof source !== 'function') {
                applicator(source);
                return;
            }
            if (!cumulativeSourceRequiredState) {
                applicator(source);
                return;
            }
            const subOwner = State_5.default.Owner.create();
            cumulativeSourceRequiredState?.use(subOwner, () => applicator(source));
            return subOwner.remove;
        }
        StringApplicatorSource.apply = apply;
    })(StringApplicatorSource || (exports.StringApplicatorSource = StringApplicatorSource = {}));
    function BaseStringApplicator(host, defaultValue, set) {
        let unbind;
        let unown;
        let subUnown;
        let removed = false;
        const state = (0, State_5.default)(defaultValue);
        const result = makeApplicator(host);
        const setInternal = set.bind(null, result);
        return result;
        function makeApplicator(host) {
            const hostOwner = host;
            State_5.default.Owner.getRemovedState(host)?.matchManual(true, () => {
                removed = true;
                unbind?.();
                unbind = undefined;
                unown?.();
                unown = undefined;
                subUnown?.();
                subUnown = undefined;
            });
            return {
                state,
                set: value => {
                    if (removed)
                        return host;
                    unbind?.();
                    unbind = undefined;
                    unown?.();
                    unown = undefined;
                    subUnown?.();
                    subUnown = undefined;
                    StringApplicatorSource.apply(setInternal, value);
                    return host;
                },
                bind: (state) => {
                    if (removed)
                        return host;
                    unbind?.();
                    unbind = undefined;
                    unown?.();
                    unown = undefined;
                    subUnown?.();
                    subUnown = undefined;
                    if (state === undefined || state === null) {
                        setInternal(defaultValue);
                        return host;
                    }
                    if (!State_5.default.is(state)) {
                        setInternal(state);
                        return host;
                    }
                    unbind = state?.use(hostOwner, state => {
                        subUnown?.();
                        subUnown = undefined;
                        StringApplicatorSource.apply(setInternal, state);
                    });
                    return host;
                },
                unbind: () => {
                    unbind?.();
                    unbind = undefined;
                    unown?.();
                    unown = undefined;
                    subUnown?.();
                    subUnown = undefined;
                    setInternal(defaultValue);
                    return host;
                },
                rehost: makeApplicator,
            };
        }
    }
    function StringApplicator(host, defaultValueOrApply, maybeApply) {
        const defaultValue = !maybeApply ? undefined : defaultValueOrApply;
        const apply = (maybeApply ?? defaultValueOrApply);
        return BaseStringApplicator(host, defaultValue, (result, value) => {
            if (value !== undefined && value !== null)
                value = StringApplicatorSource.toString(value);
            if (result.state.value !== value) {
                result.state.asMutable?.setValue(value);
                apply(value ?? undefined);
            }
        });
    }
    (function (StringApplicator) {
        function render(content) {
            return !content ? [] : StringApplicatorSource.toNodes(content);
        }
        StringApplicator.render = render;
        function Nodes(host, defaultValueOrApply, maybeApply) {
            const defaultValue = !maybeApply ? undefined : defaultValueOrApply;
            const apply = (maybeApply ?? defaultValueOrApply);
            return BaseStringApplicator(host, defaultValue, (result, value) => {
                const valueString = value !== undefined && value !== null ? StringApplicatorSource.toString(value) : undefined;
                result.state.asMutable?.setValue(valueString);
                apply(render(value));
            });
        }
        StringApplicator.Nodes = Nodes;
    })(StringApplicator || (StringApplicator = {}));
    exports.default = StringApplicator;
});
define("kitsui/utility/AttributeManipulator", ["require", "exports", "kitsui/utility/Maps", "kitsui/utility/State", "kitsui/utility/StringApplicator"], function (require, exports, Maps_1, State_6, StringApplicator_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Maps_1 = __importDefault(Maps_1);
    State_6 = __importDefault(State_6);
    function AttributeManipulator(component) {
        let removed = false;
        let translationHandlers;
        const unuseAttributeMap = new Map();
        const attributeStates = new Map();
        State_6.default.Owner.getRemovedState(component)?.matchManual(true, () => {
            removed = true;
            for (const registration of Object.values(translationHandlers ?? {}))
                registration.unuse?.();
            translationHandlers = undefined;
        });
        const result = {
            has(attribute) {
                return component.element.hasAttribute(attribute);
            },
            get(attribute) {
                return Maps_1.default.compute(attributeStates, attribute, () => (0, State_6.default)(component.element.getAttribute(attribute) ?? undefined));
            },
            append(...attributes) {
                for (const attribute of attributes) {
                    translationHandlers?.[attribute]?.unuse?.();
                    delete translationHandlers?.[attribute];
                    component.element.setAttribute(attribute, '');
                    attributeStates.get(attribute)?.asMutable?.setValue('');
                }
                return component;
            },
            prepend(...attributes) {
                const oldAttributes = {};
                for (const attribute of [...component.element.attributes]) {
                    oldAttributes[attribute.name] = attribute.value;
                    component.element.removeAttribute(attribute.name);
                }
                for (const attribute of attributes) {
                    const value = oldAttributes[attribute] ?? '';
                    component.element.setAttribute(attribute, value);
                    attributeStates.get(attribute)?.asMutable?.setValue(value);
                }
                for (const name of Object.keys(oldAttributes))
                    component.element.setAttribute(name, oldAttributes[name]);
                return component;
            },
            insertBefore(referenceAttribute, ...attributes) {
                const oldAttributes = {};
                for (const attribute of [...component.element.attributes]) {
                    oldAttributes[attribute.name] = attribute.value;
                    component.element.removeAttribute(attribute.name);
                }
                for (const attribute of Object.keys(oldAttributes)) {
                    if (attribute === referenceAttribute)
                        for (const attribute of attributes) {
                            const value = oldAttributes[attribute] ?? '';
                            component.element.setAttribute(attribute, value);
                            attributeStates.get(attribute)?.asMutable?.setValue(value);
                        }
                    component.element.setAttribute(attribute, oldAttributes[attribute]);
                }
                return component;
            },
            insertAfter(referenceAttribute, ...attributes) {
                const oldAttributes = {};
                for (const attribute of [...component.element.attributes]) {
                    oldAttributes[attribute.name] = attribute.value;
                    component.element.removeAttribute(attribute.name);
                }
                if (!(referenceAttribute in oldAttributes))
                    for (const attribute of attributes) {
                        const value = oldAttributes[attribute] ?? '';
                        component.element.setAttribute(attribute, value);
                        attributeStates.get(attribute)?.asMutable?.setValue(value);
                    }
                for (const attribute of Object.keys(oldAttributes)) {
                    component.element.setAttribute(attribute, oldAttributes[attribute]);
                    if (attribute === referenceAttribute)
                        for (const attribute of attributes) {
                            const value = oldAttributes[attribute] ?? '';
                            component.element.setAttribute(attribute, value);
                            attributeStates.get(attribute)?.asMutable?.setValue(value);
                        }
                }
                return component;
            },
            set(attribute, value) {
                translationHandlers?.[attribute]?.unuse?.();
                delete translationHandlers?.[attribute];
                if (value === undefined) {
                    component.element.removeAttribute(attribute);
                    attributeStates.get(attribute)?.asMutable?.setValue(undefined);
                }
                else {
                    component.element.setAttribute(attribute, value);
                    attributeStates.get(attribute)?.asMutable?.setValue(value);
                }
                return component;
            },
            bind(...args) {
                if (typeof args[0] === 'string') {
                    const [attribute, state] = args;
                    unuseAttributeMap.get(attribute)?.();
                    unuseAttributeMap.set(attribute, state.use(component, value => {
                        if (value === undefined) {
                            component.element.removeAttribute(attribute);
                            attributeStates.get(attribute)?.asMutable?.setValue(undefined);
                        }
                        else {
                            component.element.setAttribute(attribute, value);
                            attributeStates.get(attribute)?.asMutable?.setValue(value);
                        }
                    }));
                }
                else {
                    let [state, attribute, value, orElse] = args;
                    unuseAttributeMap.get(attribute)?.();
                    unuseAttributeMap.set(attribute, state.use(component, active => {
                        if (active) {
                            value ??= '';
                            component.element.setAttribute(attribute, value);
                            attributeStates.get(attribute)?.asMutable?.setValue(value);
                        }
                        else if (orElse !== undefined) {
                            component.element.setAttribute(attribute, orElse);
                            attributeStates.get(attribute)?.asMutable?.setValue(orElse);
                        }
                        else {
                            component.element.removeAttribute(attribute);
                            attributeStates.get(attribute)?.asMutable?.setValue(undefined);
                        }
                    }));
                }
                return component;
            },
            compute(attribute, supplier) {
                if (component.element.hasAttribute(attribute))
                    return component;
                translationHandlers?.[attribute]?.unuse?.();
                delete translationHandlers?.[attribute];
                const value = supplier(component);
                if (value === undefined) {
                    component.element.removeAttribute(attribute);
                    attributeStates.get(attribute)?.asMutable?.setValue(undefined);
                }
                else {
                    component.element.setAttribute(attribute, value);
                    attributeStates.get(attribute)?.asMutable?.setValue(value);
                }
                return component;
            },
            getUsing(attribute) {
                return translationHandlers?.[attribute]?.source;
            },
            use(attribute, source) {
                if (removed)
                    return component;
                translationHandlers?.[attribute]?.unuse?.();
                delete translationHandlers?.[attribute];
                const unuse = StringApplicator_1.StringApplicatorSource.apply(source => {
                    const registration = translationHandlers?.[attribute];
                    if (!registration)
                        return;
                    const value = StringApplicator_1.StringApplicatorSource.toString(source ?? '');
                    component.element.setAttribute(attribute, value);
                    attributeStates.get(attribute)?.asMutable?.setValue(value);
                }, source);
                translationHandlers ??= {};
                translationHandlers[attribute] = { source: source, unuse };
                return component;
            },
            remove(...attributes) {
                for (const attribute of attributes) {
                    translationHandlers?.[attribute]?.unuse?.();
                    delete translationHandlers?.[attribute];
                    component.element.removeAttribute(attribute);
                    attributeStates.get(attribute)?.asMutable?.setValue(undefined);
                }
                return component;
            },
            toggle(present, attribute, value = '') {
                return this[present ? 'set' : 'remove'](attribute, value);
            },
            copy(element) {
                if ('element' in element)
                    element = element.element;
                for (const attribute of element.attributes) {
                    component.element.setAttribute(attribute.name, attribute.value);
                    attributeStates.get(attribute.name)?.asMutable?.setValue(attribute.value);
                }
                return component;
            },
        };
        return result;
    }
    exports.default = AttributeManipulator;
});
define("kitsui/utility/ClassManipulator", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ClassManipulator(component) {
        return {
            has(...classes) {
                return classes.every(className => component.element.classList.contains(className));
            },
            some(...classes) {
                return classes.some(className => component.element.classList.contains(className));
            },
            add(...classes) {
                component.element.classList.add(...classes);
                return component;
            },
            remove(...classes) {
                component.element.classList.remove(...classes);
                return component;
            },
            toggle(present, ...classes) {
                return this[present ? 'add' : 'remove'](...classes);
            },
            copy(element) {
                if ('element' in element)
                    element = element.element;
                component.element.classList.add(...element.classList);
                return component;
            },
            bind(state, ...classes) {
                state.use(component, present => this.toggle(!!present, ...classes));
                return component;
            },
        };
    }
    exports.default = ClassManipulator;
});
define("kitsui/utility/EventManipulator", ["require", "exports", "kitsui/utility/Arrays", "kitsui/utility/State"], function (require, exports, Arrays_3, State_7) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Arrays_3 = __importDefault(Arrays_3);
    State_7 = __importDefault(State_7);
    const SYMBOL_REGISTERED_FUNCTION = Symbol('REGISTERED_FUNCTION');
    function isComponent(host) {
        return typeof host === 'object' && host !== null && 'isComponent' in host;
    }
    function EventManipulator(host) {
        const elementHost = isComponent(host)
            ? host
            : { element: document.createElement('span') };
        const manipulator = {
            emit(event, ...params) {
                const detail = { result: [], params };
                let stoppedPropagation = false;
                let preventedDefault = false;
                const eventObject = Object.assign(new CustomEvent(event, { detail }), {
                    preventDefault() {
                        Event.prototype.preventDefault.call(this);
                        preventedDefault ||= true;
                    },
                    stopPropagation() {
                        stoppedPropagation ||= true;
                    },
                    stopImmediatePropagation() {
                        stoppedPropagation = 'immediate';
                    },
                });
                elementHost.element.dispatchEvent(eventObject);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return Object.assign(detail.result, { defaultPrevented: eventObject.defaultPrevented || preventedDefault, stoppedPropagation });
            },
            bubble(event, ...params) {
                const detail = { result: [], params };
                let stoppedPropagation = false;
                let preventedDefault = false;
                const eventObject = Object.assign(new CustomEvent(event, { detail, bubbles: true }), {
                    preventDefault() {
                        Event.prototype.preventDefault.call(this);
                        preventedDefault ||= true;
                    },
                    stopPropagation() {
                        stoppedPropagation ||= true;
                    },
                    stopImmediatePropagation() {
                        stoppedPropagation = 'immediate';
                    },
                });
                elementHost.element.dispatchEvent(eventObject);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return Object.assign(detail.result, { defaultPrevented: eventObject.defaultPrevented || preventedDefault, stoppedPropagation });
            },
            subscribe(events, handler) {
                return subscribe(handler, events);
            },
            subscribePassive(events, handler) {
                return subscribe(handler, events, { passive: true });
            },
            subscribeCapture(events, handler) {
                return subscribe(handler, events, { capture: true });
            },
            unsubscribe(events, handler) {
                const realHandler = handler[SYMBOL_REGISTERED_FUNCTION];
                if (!realHandler)
                    return host;
                delete handler[SYMBOL_REGISTERED_FUNCTION];
                for (const event of Arrays_3.default.resolve(events))
                    elementHost.element.removeEventListener(event, realHandler);
                return host;
            },
            until(owner, initialiser) {
                initialiser({
                    subscribe(event, handler) {
                        manipulator.subscribe(event, handler);
                        State_7.default.Owner.getRemovedState(owner).matchManual(true, () => manipulator.unsubscribe(event, handler));
                        return this;
                    },
                    subscribeCapture(event, handler) {
                        manipulator.subscribeCapture(event, handler);
                        State_7.default.Owner.getRemovedState(owner).matchManual(true, () => manipulator.unsubscribe(event, handler));
                        return this;
                    },
                    subscribePassive(event, handler) {
                        manipulator.subscribePassive(event, handler);
                        State_7.default.Owner.getRemovedState(owner).matchManual(true, () => manipulator.unsubscribe(event, handler));
                        return this;
                    },
                });
                return host;
            },
        };
        return manipulator;
        function subscribe(handler, events, options) {
            if (handler[SYMBOL_REGISTERED_FUNCTION]) {
                console.error(`Can't register handler for event(s) ${Arrays_3.default.resolve(events).join(', ')}, already used for other events`, handler);
                return host;
            }
            const realHandler = (event) => {
                const customEvent = event instanceof CustomEvent ? event : undefined;
                const eventDetail = customEvent?.detail;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
                const result = handler(Object.assign(event, {
                    host,
                    targetComponent: getNearestComponent(event.target),
                }), ...eventDetail?.params ?? []);
                eventDetail?.result.push(result);
            };
            Object.assign(handler, { [SYMBOL_REGISTERED_FUNCTION]: realHandler });
            for (const event of Arrays_3.default.resolve(events))
                elementHost.element.addEventListener(event, realHandler, options);
            return host;
        }
    }
    function getNearestComponent(target) {
        if (!target || !(target instanceof Node))
            return undefined;
        let node = target;
        do {
            const component = node.component;
            if (component)
                return component;
        } while ((node = node.parentNode));
    }
    exports.default = EventManipulator;
});
define("kitsui/utility/FocusListener", ["require", "exports", "kitsui/utility/State"], function (require, exports, State_8) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    State_8 = __importDefault(State_8);
    var FocusListener;
    (function (FocusListener) {
        FocusListener.hasFocus = (0, State_8.default)(false);
        FocusListener.focused = (0, State_8.default)(undefined);
        FocusListener.focusedLast = (0, State_8.default)(undefined);
        function focusedComponent() {
            return FocusListener.focused.value?.component;
        }
        FocusListener.focusedComponent = focusedComponent;
        // interface QueuedFocusChange {
        // 	type: "focus" | "blur"
        // 	element: HTMLElement
        // }
        // let updatingFocusState = false
        // let cursor = 0
        // const queue: QueuedFocusChange[] = []
        function focus(element, force = false) {
            // if (updatingFocusState || exhaustingQueue) {
            // 	queue.splice(cursor, 0, { type: "focus", element })
            // 	cursor++
            // 	return
            // }
            focusInternal(element, force);
        }
        FocusListener.focus = focus;
        let focusedThisTick = 0;
        let focusTimeout;
        function focusInternal(element, force = false) {
            if (!force && document.querySelector(':focus-visible') === element)
                return;
            if (focusedThisTick > 100)
                return;
            focusedThisTick++;
            element.focus();
            window.clearTimeout(focusTimeout);
            window.setTimeout(() => focusedThisTick = 0);
            if (force) {
                updateFocusState(element);
            }
        }
        function blur(element) {
            // if (updatingFocusState || exhaustingQueue) {
            // 	queue.splice(cursor, 0, { type: "blur", element })
            // 	cursor++
            // 	return
            // }
            blurInternal(element);
        }
        FocusListener.blur = blur;
        function blurInternal(element) {
            if (document.querySelector(':focus-visible') !== element)
                return;
            element.blur();
        }
        function listen() {
            document.addEventListener('focusin', onFocusIn);
            document.addEventListener('focusout', onFocusOut);
        }
        FocusListener.listen = listen;
        function onFocusIn() {
            updateFocusState();
        }
        function onFocusOut(event) {
            if (event.relatedTarget === null)
                updateFocusState();
        }
        // let exhaustingQueue = false
        function updateFocusState(element) {
            if (document.activeElement && document.activeElement !== document.body && location.hash && document.activeElement.id !== location.hash.slice(1))
                history.pushState(undefined, '', ' ');
            const newFocused = element ?? document.querySelector(':focus-visible') ?? undefined;
            if (newFocused === FocusListener.focused.value)
                return;
            // updatingFocusState = true
            const lastLastFocusedComponent = FocusListener.focusedLast.value?.component;
            if (lastLastFocusedComponent) {
                lastLastFocusedComponent.hadFocusedLast.asMutable?.setValue(false);
                for (const ancestor of lastLastFocusedComponent.getAncestorComponents())
                    ancestor.hadFocusedLast.asMutable?.setValue(false);
            }
            const lastFocusedComponent = FocusListener.focused.value?.component;
            const focusedComponent = newFocused?.component;
            const oldAncestors = !lastFocusedComponent ? undefined : [...lastFocusedComponent.getAncestorComponents()];
            const newAncestors = !focusedComponent ? undefined : [...focusedComponent.getAncestorComponents()];
            const lastFocusedContainsFocused = FocusListener.focused.value?.contains(newFocused ?? null);
            FocusListener.focusedLast.value = FocusListener.focused.value;
            FocusListener.focused.value = newFocused;
            FocusListener.hasFocus.value = !!newFocused;
            if (lastFocusedComponent) {
                if (!lastFocusedContainsFocused) {
                    if (!focusedComponent)
                        // setting "had focused" must happen before clearing "has focused"
                        // just in case anything is listening for hasFocused || hadFocusedLast
                        lastFocusedComponent.hadFocusedLast.asMutable?.setValue(true);
                    lastFocusedComponent.hasFocusedTime.asMutable?.setValue(undefined);
                }
                lastFocusedComponent.focusedTime.asMutable?.setValue(undefined);
            }
            if (focusedComponent) {
                focusedComponent.focusedTime.asMutable?.setValue(Date.now());
                focusedComponent.hasFocusedTime.asMutable?.setValue(Date.now());
            }
            if (oldAncestors)
                for (const ancestor of oldAncestors)
                    if (!newAncestors?.includes(ancestor))
                        if (ancestor) {
                            if (!focusedComponent)
                                // setting "had focused" must happen before clearing "has focused"
                                // just in case anything is listening for hasFocused || hadFocusedLast
                                ancestor.hadFocusedLast.asMutable?.setValue(true);
                            ancestor.hasFocusedTime.asMutable?.setValue(undefined);
                        }
            if (newAncestors)
                for (const ancestor of newAncestors)
                    if (ancestor)
                        ancestor.hasFocusedTime.asMutable?.setValue(Date.now());
            // updatingFocusState = false
            // if (exhaustingQueue)
            // 	return
            // exhaustingQueue = true
            // for (cursor = 0; cursor < queue.length; cursor++) {
            // 	const change = queue[cursor]
            // 	if (change.type === "blur")
            // 		blurInternal(change.element)
            // 	else if (change.type === "focus")
            // 		focusInternal(change.element)
            // }
            // queue.splice(0, Infinity)
            // cursor = 0
            // exhaustingQueue = false
        }
    })(FocusListener || (FocusListener = {}));
    exports.default = FocusListener;
    Object.assign(window, { FocusListener });
});
define("kitsui/utility/StyleManipulator", ["require", "exports", "kitsui/utility/Arrays", "kitsui/utility/State"], function (require, exports, Arrays_4, State_9) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.style = void 0;
    Arrays_4 = __importStar(Arrays_4);
    State_9 = __importDefault(State_9);
    exports.style = (0, State_9.default)({});
    function StyleManipulator(component) {
        const styles = new Set();
        const currentClasses = [];
        // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
        const stateUnsubscribers = new WeakMap();
        const unbindPropertyState = {};
        const styleState = State_9.default.JIT(() => styles);
        const combinations = [];
        // if (Env.isDev)
        exports.style.subscribe(component, () => updateClasses());
        const result = Object.assign(
        // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
        ((...names) => {
            for (const name of names)
                if (typeof name === 'string')
                    styles.add(name);
                else
                    result.bindFrom(name);
            updateClasses();
            return component;
        }), {
            get: () => [...styles].sort(),
            has(name) {
                return styles.has(name);
            },
            getState(owner, name) {
                return styleState.map(owner, styles => styles.has(name));
            },
            remove(...names) {
                for (const name of names)
                    styles.delete(name);
                updateClasses();
                return component;
            },
            toggle(enabled, ...names) {
                if (enabled)
                    for (const name of names)
                        styles.add(name);
                else
                    for (const name of names)
                        styles.delete(name);
                updateClasses();
                return component;
            },
            bind(state, ...toAdd) {
                if (State_9.default.is(toAdd[0])) {
                    const actualInputState = State_9.default.is(state) ? state : undefined;
                    result.unbind(actualInputState);
                    state = State_9.default.get(state);
                    const owner = State_9.default.Owner.create();
                    const currentNames = [];
                    State_9.default.Use(owner, { state: state, names: toAdd[0] }).use(owner, ({ state, names }, { state: oldState, names: oldNames } = { state: false, names: undefined }) => {
                        oldNames = oldNames && oldState ? Array.isArray(oldNames) ? oldNames : [oldNames] : [];
                        names = names && state ? Array.isArray(names) ? names : [names] : [];
                        for (const oldName of oldNames ?? [])
                            styles.delete(oldName);
                        for (const name of names)
                            styles.add(name);
                        currentNames.splice(0, Infinity, ...names);
                        updateClasses();
                    });
                    if (actualInputState)
                        stateUnsubscribers.set(actualInputState, [owner.remove, currentNames]);
                    return component;
                }
                const names = toAdd;
                if (!State_9.default.is(state))
                    return result.toggle(state, ...names);
                result.unbind(state);
                const unsubscribe = state.use(component, active => {
                    if (active)
                        for (const name of names)
                            styles.add(name);
                    else
                        for (const name of names)
                            styles.delete(name);
                    updateClasses();
                });
                stateUnsubscribers.set(state, [unsubscribe, names]);
                return component;
            },
            bindFrom(state) {
                result.unbind(state);
                const currentNames = [];
                const unsubscribe = state.use(component, (names, oldNames) => {
                    if (!Array.isArray(names))
                        names = names ? [names] : [];
                    if (!Array.isArray(oldNames))
                        oldNames = oldNames ? [oldNames] : [];
                    for (const oldName of oldNames ?? [])
                        styles.delete(oldName);
                    for (const name of names)
                        styles.add(name);
                    currentNames.splice(0, Infinity, ...names);
                    updateClasses();
                });
                stateUnsubscribers.set(state, [unsubscribe, currentNames]);
                return component;
            },
            unbind(state) {
                const bound = state && stateUnsubscribers.get(state);
                if (!bound)
                    return component;
                const [unsubscribe, names] = bound;
                unsubscribe?.();
                stateUnsubscribers.delete(state);
                result.remove(...names);
                return component;
            },
            combine(combined, requirements) {
                combinations.push({ combined, requirements });
                return component;
            },
            uncombine(combined) {
                Arrays_4.default.filterInPlace(combinations, combination => combination.combined !== combined);
                result.remove(combined);
                return component;
            },
            refresh: () => updateClasses(),
            hasProperty(property) {
                return component.element.style.getPropertyValue(property) !== '';
            },
            setProperty(property, value) {
                unbindPropertyState[property]?.();
                setProperty(property, value);
                return component;
            },
            setProperties(properties) {
                for (let [property, value] of Object.entries(properties)) {
                    unbindPropertyState[property]?.();
                    property = property.replaceAll(/[a-z][A-Z]/g, match => `${match[0]}-${match[1].toLowerCase()}`).toLowerCase();
                    setProperty(property, value);
                }
                return component;
            },
            toggleProperty(enabled, property, value) {
                enabled ??= !result.hasProperty(property);
                if (enabled === true)
                    return result.setProperty(property, enabled ? value : undefined);
                else
                    return result.removeProperties(property);
            },
            setVariable(variable, value) {
                return result.setProperty(`--${variable}`, value);
            },
            bindProperty(property, state) {
                unbindPropertyState[property]?.();
                if (State_9.default.is(state))
                    unbindPropertyState[property] = state.use(component, value => setProperty(property, value));
                else {
                    setProperty(property, state);
                    unbindPropertyState[property] = undefined;
                }
                return component;
            },
            bindVariable(variable, state) {
                return result.bindProperty(`--${variable}`, state);
            },
            removeProperties(...properties) {
                for (const property of properties)
                    component.element.style.removeProperty(property);
                return component;
            },
            removeVariables(...variables) {
                for (const variable of variables)
                    component.element.style.removeProperty(`--${variable}`);
                return component;
            },
        });
        return result;
        function updateClasses() {
            const stylesArray = [...styles];
            for (const combination of combinations) {
                const hasRequirements = combination.requirements.every(name => styles.has(name));
                if (hasRequirements) {
                    styles.add(combination.combined);
                    stylesArray.push(combination.combined);
                }
                else {
                    styles.delete(combination.combined);
                    Arrays_4.default.remove(stylesArray, combination.combined);
                }
            }
            if (!component.attributes.has('component'))
                component.attributes.insertBefore('class', 'component');
            component.attributes.set('component', stylesArray.join(' '));
            const toAdd = stylesArray.flatMap(component => exports.style.value[component]).filter(Arrays_4.NonNullish);
            const toRemove = currentClasses.filter(cls => !toAdd.includes(cls));
            if (toRemove)
                component.element.classList.remove(...toRemove);
            component.element.classList.add(...toAdd);
            currentClasses.push(...toAdd);
            styleState.markDirty();
            return component;
        }
        function setProperty(property, value) {
            if (value === undefined || value === null)
                component.element.style.removeProperty(property);
            else
                component.element.style.setProperty(property, `${value}`);
        }
    }
    exports.default = StyleManipulator;
});
define("kitsui/utility/TextManipulator", ["require", "exports", "kitsui/utility/StringApplicator"], function (require, exports, StringApplicator_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    StringApplicator_2 = __importDefault(StringApplicator_2);
    function TextManipulator(component, target = component) {
        return apply(StringApplicator_2.default.Nodes(component, nodes => {
            target.removeContents();
            target.append(...nodes);
            return nodes;
        }));
        function apply(applicator) {
            const rehost = applicator.rehost;
            return Object.assign(applicator, {
                prepend(text) {
                    target.prepend(...StringApplicator_2.default.render(text));
                    return component;
                },
                append(text) {
                    target.append(...StringApplicator_2.default.render(text));
                    return component;
                },
                rehost(component) {
                    return apply(rehost(component));
                },
            });
        }
    }
    exports.default = TextManipulator;
});
define("kitsui/Component", ["require", "exports", "kitsui/utility/AnchorManipulator", "kitsui/utility/Arrays", "kitsui/utility/AttributeManipulator", "kitsui/utility/ClassManipulator", "kitsui/utility/EventManipulator", "kitsui/utility/FocusListener", "kitsui/utility/Maps", "kitsui/utility/Objects", "kitsui/utility/State", "kitsui/utility/StringApplicator", "kitsui/utility/Strings", "kitsui/utility/StyleManipulator", "kitsui/utility/TextManipulator", "kitsui/utility/Viewport"], function (require, exports, AnchorManipulator_1, Arrays_5, AttributeManipulator_1, ClassManipulator_1, EventManipulator_1, FocusListener_1, Maps_2, Objects_2, State_10, StringApplicator_3, Strings_2, StyleManipulator_1, TextManipulator_1, Viewport_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ComponentPerf = exports.ComponentInsertionDestination = void 0;
    AnchorManipulator_1 = __importDefault(AnchorManipulator_1);
    AttributeManipulator_1 = __importDefault(AttributeManipulator_1);
    ClassManipulator_1 = __importDefault(ClassManipulator_1);
    EventManipulator_1 = __importDefault(EventManipulator_1);
    FocusListener_1 = __importDefault(FocusListener_1);
    Maps_2 = __importDefault(Maps_2);
    State_10 = __importDefault(State_10);
    StringApplicator_3 = __importDefault(StringApplicator_3);
    Strings_2 = __importDefault(Strings_2);
    StyleManipulator_1 = __importDefault(StyleManipulator_1);
    TextManipulator_1 = __importDefault(TextManipulator_1);
    Viewport_2 = __importDefault(Viewport_2);
    const selfScript = (0, State_10.default)(undefined);
    const SYMBOL_COMPONENT_BRAND = Symbol('COMPONENT_BRAND');
    const ELEMENT_TO_COMPONENT_MAP = new WeakMap();
    (0, Objects_2.DefineMagic)(Element.prototype, 'component', {
        get() {
            return ELEMENT_TO_COMPONENT_MAP.get(this);
        },
        set(component) {
            if (component) {
                ELEMENT_TO_COMPONENT_MAP.set(this, component);
            }
            else {
                ELEMENT_TO_COMPONENT_MAP.delete(this);
            }
        },
    });
    var ComponentInsertionDestination;
    (function (ComponentInsertionDestination) {
        function is(value) {
            return typeof value === 'object' && !!value?.isInsertionDestination;
        }
        ComponentInsertionDestination.is = is;
    })(ComponentInsertionDestination || (exports.ComponentInsertionDestination = ComponentInsertionDestination = {}));
    var Classes;
    (function (Classes) {
        Classes["ReceiveRootedEvents"] = "_receive-rooted-events";
        Classes["ReceiveAncestorInsertEvents"] = "_receieve-ancestor-insert-events";
        Classes["ReceiveDescendantInsertEvents"] = "_receieve-descendant-insert-events";
        Classes["ReceiveDescendantRemoveEvents"] = "_receieve-descendant-remove-events";
        Classes["ReceiveAncestorRectDirtyEvents"] = "_receieve-ancestor-rect-dirty-events";
        Classes["ReceiveChildrenInsertEvents"] = "_receive-children-insert-events";
        Classes["ReceiveInsertEvents"] = "_receive-insert-events";
        Classes["ReceiveScrollEvents"] = "_receieve-scroll-events";
        Classes["HasRect"] = "_has-rect";
        Classes["HasStatesToMarkDirtyOnInsertions"] = "_has-states-to-mark-dirty-on-insertions";
    })(Classes || (Classes = {}));
    const SYMBOL_RECT_STATE = Symbol('RECT_STATE');
    const SYMBOL_CALLBACKS_ON_INSERTIONS = Symbol('CALLBACKS_ON_INSERTIONS');
    var ComponentPerf;
    (function (ComponentPerf) {
        function Rect(component) {
            return component?.[SYMBOL_RECT_STATE];
        }
        ComponentPerf.Rect = Rect;
        (function (Rect) {
            function assign(component, rectState) {
                component[SYMBOL_RECT_STATE] = rectState;
            }
            Rect.assign = assign;
        })(Rect = ComponentPerf.Rect || (ComponentPerf.Rect = {}));
        let CallbacksOnInsertions;
        (function (CallbacksOnInsertions) {
            function add(component, callback) {
                const states = component[SYMBOL_CALLBACKS_ON_INSERTIONS] ??= [];
                states.push(callback);
            }
            CallbacksOnInsertions.add = add;
            function get(component) {
                return component?.[SYMBOL_CALLBACKS_ON_INSERTIONS] ?? [];
            }
            CallbacksOnInsertions.get = get;
        })(CallbacksOnInsertions = ComponentPerf.CallbacksOnInsertions || (ComponentPerf.CallbacksOnInsertions = {}));
    })(ComponentPerf || (exports.ComponentPerf = ComponentPerf = {}));
    const componentExtensionsRegistry = [];
    let componentLeakDetectors = [];
    const timeUntilLeakWarning = 10000;
    setInterval(() => {
        const now = Date.now();
        const leakedComponents = componentLeakDetectors.filter(detector => true
            && now - detector.built > timeUntilLeakWarning
            && !detector.component.rooted.value
            && !detector.component.removed.value
            && !detector.component.hasOwner()
            && !detector.component.getAncestorComponents().some(ancestor => ancestor.hasOwner()));
        if (leakedComponents.length)
            console.warn('Leaked components:', ...leakedComponents.map(detector => detector.component));
        componentLeakDetectors = componentLeakDetectors.filter(detector => now - detector.built <= timeUntilLeakWarning);
    }, 100);
    function Component(type, builder) {
        if (typeof type === 'function' || typeof builder === 'function')
            return Component.Builder(type, builder);
        type ??= 'span';
        if (!canBuildComponents)
            throw new Error('Components cannot be built yet');
        let unuseIdState;
        let unuseNameState;
        let unuseAriaLabelledByIdState;
        let unuseAriaControlsIdState;
        let unuseOwnerRemove;
        let descendantsListeningForScroll;
        let descendantRectsListeningForScroll;
        const jitTweaks = new Map();
        const nojit = {};
        const rooted = (0, State_10.default)(false);
        const removed = (0, State_10.default)(false);
        let component = {
            supers: (0, State_10.default)([]),
            isComponent: true,
            isInsertionDestination: true,
            element: document.createElement(type),
            get removed() {
                componentLeakDetectors.push({
                    built: Date.now(),
                    component,
                });
                return (0, Objects_2.DefineProperty)(component, 'removed', removed);
            },
            rooted,
            nojit: nojit,
            get tagName() {
                return component.element.tagName;
            },
            setOwner: newOwner => {
                unuseOwnerRemove?.();
                unuseOwnerRemove = undefined;
                if (!newOwner)
                    return component;
                const removedState = State_10.default.Owner.getRemovedState(newOwner);
                unuseOwnerRemove = removedState?.use(component, removed => removed && component.remove());
                if (!removedState)
                    component.remove();
                return component;
            },
            hasOwner: () => !!unuseOwnerRemove,
            replaceElement: (newElement, keepContent) => {
                if (typeof newElement === 'string' && newElement.toUpperCase() === component.element.tagName.toUpperCase())
                    return component; // already correct tag type
                if (typeof newElement === 'string')
                    newElement = document.createElement(newElement);
                const oldElement = component.element;
                if (!keepContent) {
                    Component.removeContents(newElement);
                    newElement.replaceChildren(...component.element.childNodes);
                }
                if (component.element.parentNode)
                    component.element.replaceWith(newElement);
                component.element = newElement;
                type = component.element.tagName;
                ELEMENT_TO_COMPONENT_MAP.delete(oldElement);
                ELEMENT_TO_COMPONENT_MAP.set(newElement, component);
                component.attributes.copy(oldElement);
                // component.style.refresh()
                return component;
            },
            is: (builder) => !builder || (Array.isArray(builder) ? builder : [builder]).some(builder => component.supers.value.includes(builder)),
            as: (builder) => !builder || component.supers.value.includes(builder) ? component : undefined,
            cast: () => component,
            and(builder, ...params) {
                if (component.is(builder))
                    return component;
                const result = builder.from(component, ...params);
                if (result instanceof Promise)
                    return result.then(result => {
                        component = result;
                        component.supers.value.push(builder);
                        component.supers.emit();
                        if (builder.name)
                            component.attributes.prepend(`:${builder.name.kebabcase}`);
                        return component;
                    });
                component = result;
                component.supers.value.push(builder);
                component.supers.emit();
                if (builder.name)
                    component.attributes.prepend(`:${builder.name.kebabcase}`);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return component;
            },
            extend: extension => Object.assign(component, extension(component)),
            override: (property, provider) => {
                const original = component[property];
                component[property] = provider(component, original);
                return component;
            },
            extendMagic: (property, magic) => {
                (0, Objects_2.DefineMagic)(component, property, magic(component));
                return component;
            },
            extendJIT: (property, supplier) => {
                (0, Objects_2.DefineMagic)(component, property, {
                    get: () => {
                        const value = supplier(component);
                        (0, Objects_2.DefineProperty)(component, property, value);
                        const tweaks = jitTweaks.get(property);
                        if (tweaks && tweaks !== true)
                            for (const tweaker of tweaks)
                                tweaker(value, component);
                        jitTweaks.set(property, true);
                        return value;
                    },
                    set: value => {
                        (0, Objects_2.DefineProperty)(component, property, value);
                        nojit[property] = value;
                    },
                });
                return component;
            },
            tweakJIT: (property, tweaker) => {
                const tweaks = Maps_2.default.compute(jitTweaks, property, () => new Set());
                if (tweaks === true)
                    tweaker(component[property], component);
                else
                    tweaks.add(tweaker);
                return component;
            },
            tweak: (tweaker, ...params) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                tweaker?.(component, ...params);
                return component;
            },
            addStyleTargets(styleEnum) {
                const keys = Object.keys(styleEnum).filter(key => isNaN(+key));
                for (const key of keys)
                    component.styleTargets[key] = (0, State_10.default)(undefined);
                return component;
            },
            ...{
                // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
                styleTargets(style) {
                    for (const [key, name] of Object.entries(style))
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-redundant-type-constituents
                        component.styleTargets[key].asMutable?.setValue(name ?? undefined);
                    return component;
                },
            },
            get style() {
                return (0, Objects_2.DefineProperty)(component, 'style', (0, StyleManipulator_1.default)(component));
            },
            get classes() {
                return (0, Objects_2.DefineProperty)(component, 'classes', (0, ClassManipulator_1.default)(component));
            },
            get attributes() {
                return (0, Objects_2.DefineProperty)(component, 'attributes', (0, AttributeManipulator_1.default)(component));
            },
            get event() {
                return (0, Objects_2.DefineProperty)(component, 'event', (0, EventManipulator_1.default)(component));
            },
            get text() {
                return (0, Objects_2.DefineProperty)(component, 'text', (0, TextManipulator_1.default)(component));
            },
            get anchor() {
                return (0, Objects_2.DefineProperty)(component, 'anchor', (0, AnchorManipulator_1.default)(component));
            },
            get hovered() {
                return (0, Objects_2.DefineProperty)(component, 'hovered', component.hoveredTime.mapManual(time => !!time));
            },
            get hoveredTime() {
                return (0, Objects_2.DefineProperty)(component, 'hoveredTime', (0, State_10.default)(undefined));
            },
            get focused() {
                return (0, Objects_2.DefineProperty)(component, 'focused', component.focusedTime.mapManual(time => !!time));
            },
            get focusedTime() {
                return (0, Objects_2.DefineProperty)(component, 'focusedTime', (0, State_10.default)(undefined));
            },
            get hasFocused() {
                return (0, Objects_2.DefineProperty)(component, 'hasFocused', component.hasFocusedTime.mapManual(time => !!time));
            },
            get hasFocusedTime() {
                return (0, Objects_2.DefineProperty)(component, 'hasFocusedTime', (0, State_10.default)(undefined));
            },
            get hadFocusedLast() {
                return (0, Objects_2.DefineProperty)(component, 'hadFocusedLast', (0, State_10.default)(false));
            },
            get hoveredOrFocused() {
                return (0, Objects_2.DefineProperty)(component, 'hoveredOrFocused', component.hoveredOrFocusedTime.mapManual(time => !!time));
            },
            get hoveredOrFocusedTime() {
                return (0, Objects_2.DefineProperty)(component, 'hoveredOrFocusedTime', State_10.default.Generator(() => Math.max(component.hoveredTime.value ?? 0, component.focusedTime.value ?? 0) || undefined)
                    .observe(component, component.hoveredTime, component.focusedTime));
            },
            get hoveredOrHasFocused() {
                return (0, Objects_2.DefineProperty)(component, 'hoveredOrHasFocused', component.hoveredOrHasFocusedTime.mapManual(time => !!time));
            },
            get hoveredOrHasFocusedTime() {
                return (0, Objects_2.DefineProperty)(component, 'hoveredOrHasFocusedTime', State_10.default.Generator(() => Math.max(component.hoveredTime.value ?? 0, component.hasFocusedTime.value ?? 0) || undefined)
                    .observe(component, component.hoveredTime, component.hasFocusedTime));
            },
            get active() {
                return (0, Objects_2.DefineProperty)(component, 'active', component.activeTime.mapManual(time => !!time));
            },
            get activeTime() {
                return (0, Objects_2.DefineProperty)(component, 'activeTime', (0, State_10.default)(undefined));
            },
            get id() {
                return (0, Objects_2.DefineProperty)(component, 'id', (0, State_10.default)(undefined));
            },
            get name() {
                return (0, Objects_2.DefineProperty)(component, 'name', (0, State_10.default)(undefined));
            },
            ...{
                [SYMBOL_RECT_STATE]: undefined,
            },
            get rect() {
                const rectState = State_10.default.JIT(() => component.element.getBoundingClientRect());
                ComponentPerf.Rect.assign(component, rectState);
                const oldMarkDirty = rectState.markDirty;
                rectState.markDirty = () => {
                    oldMarkDirty();
                    for (const descendant of this.element.getElementsByClassName(Classes.HasRect))
                        ComponentPerf.Rect(descendant.component)?.markDirty();
                    for (const descendant of this.element.getElementsByClassName(Classes.ReceiveAncestorRectDirtyEvents))
                        descendant.component?.event.emit('ancestorRectDirty');
                    return rectState;
                };
                // this.receiveInsertEvents()
                // this.receiveAncestorInsertEvents()
                // this.receiveAncestorScrollEvents()
                this.classes.add(
                // Classes.ReceiveAncestorRectDirtyEvents,
                Classes.HasRect);
                // this.event.subscribe(['insert', 'ancestorInsert', 'ancestorScroll', 'ancestorRectDirty'], rectState.markDirty)
                Viewport_2.default.size.subscribe(component, rectState.markDirty);
                return (0, Objects_2.DefineProperty)(component, 'rect', rectState);
            },
            get fullType() {
                return ''
                    + (component.tagName.startsWith(':') ? '' : `<${component.tagName}> `)
                    + (!component.supers.value.length ? ''
                        : ':' + component.supers.value.map((t) => t.name.kebabcase).join(' :'));
            },
            setId: id => {
                unuseIdState?.();
                unuseIdState = undefined;
                if (id && typeof id !== 'string')
                    unuseIdState = id.use(component, setId);
                else
                    setId(id);
                return component;
                function setId(id) {
                    if (id) {
                        component.element.setAttribute('id', id);
                        component.id.asMutable?.setValue(id);
                    }
                    else {
                        component.element.removeAttribute('id');
                        component.id.asMutable?.setValue(undefined);
                    }
                }
            },
            setRandomId: () => {
                component.setId(Strings_2.default.uid());
                return component;
            },
            setName: name => {
                unuseNameState?.();
                unuseNameState = undefined;
                if (name && typeof name !== 'string')
                    unuseNameState = name.use(component, setName);
                else
                    setName(name);
                return component;
                function setName(name) {
                    if (name) {
                        name = name.replace(/[^\w-]+/g, '-').toLowerCase();
                        component.element.setAttribute('name', name);
                        component.name.asMutable?.setValue(name);
                    }
                    else {
                        component.element.removeAttribute('name');
                        component.name.asMutable?.setValue(undefined);
                    }
                }
            },
            disableInsertion() {
                return component;
            },
            remove() {
                component.removeContents();
                component.removed.asMutable?.setValue(true);
                component.rooted.asMutable?.setValue(false);
                component.element.component = undefined;
                component.element.remove();
                emitRemove(component);
                if (component.classes.has(Classes.ReceiveRootedEvents))
                    component.event.emit('unroot');
                unuseOwnerRemove?.();
                unuseOwnerRemove = undefined;
                unuseAriaControlsIdState?.();
                unuseAriaControlsIdState = undefined;
                unuseAriaLabelledByIdState?.();
                unuseAriaLabelledByIdState = undefined;
                unuseIdState?.();
                unuseIdState = undefined;
                unuseNameState?.();
                unuseNameState = undefined;
            },
            appendTo(destination) {
                destination.append(component.element);
                component.emitInsert();
                return component;
            },
            prependTo(destination) {
                destination.prepend(component.element);
                component.emitInsert();
                return component;
            },
            insertTo(destination, direction, sibling) {
                if (ComponentInsertionDestination.is(destination)) {
                    destination.insert(direction, sibling, component);
                    component.emitInsert();
                    return component;
                }
                const siblingElement = sibling ? Component.element(sibling) : null;
                if (direction === 'before')
                    destination.insertBefore(component.element, siblingElement);
                else
                    destination.insertBefore(component.element, !siblingElement ? destination.firstChild : siblingElement?.nextSibling);
                component.emitInsert();
                return component;
            },
            append(...contents) {
                if (component.removed.value) {
                    for (let content of contents) {
                        content = Component.get(content) ?? content;
                        if (Component.is(content))
                            content.remove();
                    }
                    return component;
                }
                const elements = contents.filter(Arrays_5.Truthy).map(Component.element);
                component.element.append(...elements);
                for (const element of elements)
                    element.component?.emitInsert();
                if (component.classes.has(Classes.ReceiveChildrenInsertEvents))
                    component.event.emit('childrenInsert', elements);
                return component;
            },
            prepend(...contents) {
                if (component.removed.value) {
                    for (let content of contents) {
                        content = Component.get(content) ?? content;
                        if (Component.is(content))
                            content.remove();
                    }
                    return component;
                }
                const elements = contents.filter(Arrays_5.Truthy).map(Component.element);
                component.element.prepend(...elements);
                for (const element of elements)
                    element.component?.emitInsert();
                if (component.classes.has(Classes.ReceiveChildrenInsertEvents))
                    component.event.emit('childrenInsert', elements);
                return component;
            },
            insert(direction, sibling, ...contents) {
                if (component.removed.value) {
                    for (let content of contents) {
                        content = Component.get(content) ?? content;
                        if (Component.is(content))
                            content.remove();
                    }
                    return component;
                }
                const siblingElement = sibling ? Component.element(sibling) : null;
                const elements = contents.filter(Arrays_5.Truthy).map(Component.element);
                if (direction === 'before')
                    for (let i = elements.length - 1; i >= 0; i--)
                        component.element.insertBefore(elements[i], siblingElement);
                else
                    for (const element of elements)
                        component.element.insertBefore(element, !siblingElement ? component.element.firstChild : siblingElement?.nextSibling);
                for (const element of elements)
                    element.component?.emitInsert();
                if (component.classes.has(Classes.ReceiveChildrenInsertEvents))
                    component.event.emit('childrenInsert', elements);
                return component;
            },
            removeContents() {
                Component.removeContents(component.element);
                return component;
            },
            closest(builder) {
                return Component.closest(builder, component);
            },
            getStateForClosest(builders) {
                const state = State_10.default.JIT(() => component.closest(builders));
                ComponentPerf.CallbacksOnInsertions.add(component, state.markDirty);
                component.classes.add(Classes.HasStatesToMarkDirtyOnInsertions);
                // component.receiveAncestorInsertEvents()
                // component.onRooted(() => {
                // 	state.markDirty()
                // component.receiveInsertEvents()
                // component.event.subscribe(['insert', 'ancestorInsert'], () => state.markDirty())
                // })
                return state;
            },
            get parent() {
                return component.element.parentElement?.component;
            },
            get previousSibling() {
                return component.element.previousElementSibling?.component;
            },
            getPreviousSibling(builder) {
                const [sibling] = component.getPreviousSiblings(builder);
                return sibling;
            },
            get nextSibling() {
                return component.element.nextElementSibling?.component;
            },
            getNextSibling(builder) {
                const [sibling] = component.getNextSiblings(builder);
                return sibling;
            },
            *getAncestorComponents(builder) {
                let cursor = component.element;
                while (cursor) {
                    cursor = cursor.parentElement;
                    const component = cursor?.component;
                    if (component?.is(builder))
                        yield component;
                }
            },
            *getChildren(builder) {
                for (const child of component.element.children) {
                    const component = child.component;
                    if (component?.is(builder))
                        yield component;
                }
            },
            *getSiblings(builder) {
                const parent = component.element.parentElement;
                for (const child of parent?.children ?? [])
                    if (child !== component.element) {
                        const component = child.component;
                        if (component?.is(builder))
                            yield component;
                    }
            },
            *getPreviousSiblings(builder) {
                const parent = component.element.parentElement;
                for (const child of parent?.children ?? []) {
                    if (child === component.element)
                        break;
                    const childComponent = child.component;
                    if (childComponent?.is(builder))
                        yield childComponent;
                }
            },
            *getNextSiblings(builder) {
                let cursor = component.element;
                while ((cursor = cursor.nextElementSibling)) {
                    const component = cursor.component;
                    if (component?.is(builder))
                        yield component;
                }
            },
            *getDescendants(builder) {
                const walker = document.createTreeWalker(component.element, NodeFilter.SHOW_ELEMENT);
                let node;
                while ((node = walker.nextNode())) {
                    const component = node.component;
                    if (component?.is(builder))
                        yield component;
                }
            },
            getFirstDescendant(builder) {
                const [first] = component.getDescendants(builder);
                return first;
            },
            contains(elementOrComponent) {
                const descendant = Component.is(elementOrComponent) ? elementOrComponent.element : elementOrComponent;
                return descendant === undefined || descendant === null ? false : component.element.contains(descendant);
            },
            receiveRootedEvents() {
                component.element.classList.add(Classes.ReceiveRootedEvents);
                return component;
            },
            receiveAncestorInsertEvents: () => {
                component.element.classList.add(Classes.ReceiveAncestorInsertEvents);
                return component;
            },
            receiveDescendantInsertEvents: () => {
                component.element.classList.add(Classes.ReceiveDescendantInsertEvents);
                return component;
            },
            receiveDescendantRemoveEvents: () => {
                component.element.classList.add(Classes.ReceiveDescendantRemoveEvents);
                return component;
            },
            receiveAncestorScrollEvents() {
                component.element.classList.add(Classes.ReceiveScrollEvents);
                return component;
            },
            receiveChildrenInsertEvents() {
                component.element.classList.add(Classes.ReceiveChildrenInsertEvents);
                return component;
            },
            receiveInsertEvents() {
                component.element.classList.add(Classes.ReceiveInsertEvents);
                return component;
            },
            emitInsert: () => {
                updateRooted(component);
                emitInsert(component);
                return component;
            },
            monitorScrollEvents() {
                descendantsListeningForScroll ??= (component.element === window ? document.documentElement : component.element).getElementsByClassName(Classes.ReceiveScrollEvents);
                descendantRectsListeningForScroll ??= (component.element === window ? document.documentElement : component.element).getElementsByClassName(Classes.HasRect);
                component.event.subscribe('scroll', () => {
                    for (const descendant of [...descendantsListeningForScroll])
                        descendant.component?.event.emit('ancestorScroll');
                    for (const descendant of [...descendantRectsListeningForScroll])
                        ComponentPerf.Rect(descendant.component)?.markDirty();
                });
                return component;
            },
            onRooted(callback) {
                component.rooted.matchManual(true, () => callback(component));
                return component;
            },
            onRemove(owner, callback) {
                component.removed.match(owner, true, () => callback(component));
                return component;
            },
            onRemoveManual(callback) {
                component.removed.matchManual(true, () => callback(component));
                return component;
            },
            ariaRole: (role) => {
                if (!role)
                    return component.attributes.remove('role');
                return component.attributes.set('role', role);
            },
            get ariaLabel() {
                return (0, Objects_2.DefineProperty)(component, 'ariaLabel', (0, StringApplicator_3.default)(component, value => component.attributes.set('aria-label', value)));
            },
            ariaLabelledBy: labelledBy => {
                unuseAriaLabelledByIdState?.();
                unuseAriaLabelledByIdState = undefined;
                if (labelledBy) {
                    const state = State_10.default.Generator(() => labelledBy.id.value ?? labelledBy.attributes.get('for'))
                        .observe(component, labelledBy.id, labelledBy.cast()?.for);
                    unuseAriaLabelledByIdState = state.use(component, id => component.attributes.set('aria-labelledby', id));
                }
                return component;
            },
            ariaHidden: () => component.attributes.set('aria-hidden', 'true'),
            ariaChecked: state => {
                state.use(component, state => component.attributes.set('aria-checked', `${state}`));
                return component;
            },
            ariaControls: target => {
                unuseAriaControlsIdState?.();
                unuseAriaControlsIdState = target?.id.use(component, id => component.attributes.set('aria-controls', id));
                return component;
            },
            tabIndex: index => {
                if (index === undefined)
                    component.element.removeAttribute('tabindex');
                else if (index === 'programmatic')
                    component.element.setAttribute('tabindex', '-1');
                else if (index === 'auto')
                    component.element.setAttribute('tabindex', '0');
                else
                    component.element.setAttribute('tabindex', `${index}`);
                return component;
            },
            focus: () => {
                FocusListener_1.default.focus(component.element);
                return component;
            },
            blur: () => {
                FocusListener_1.default.blur(component.element);
                return component;
            },
        };
        // WeavingArg.setRenderable(component, () => component.element.textContent ?? '')
        // Objects.stringify.disable(component)
        for (const extension of componentExtensionsRegistry)
            extension(component);
        if (!Component.is(component))
            throw new Error('This should never happen');
        component.element.component = component;
        return component;
    }
    function emitInsert(component) {
        if (!component)
            return;
        ComponentPerf.Rect(component)?.markDirty();
        for (const callback of ComponentPerf.CallbacksOnInsertions.get(component))
            callback();
        if (component.classes.has(Classes.ReceiveInsertEvents))
            component.event.emit('insert');
        const descendantsListeningForEvent = component.element.getElementsByClassName(Classes.ReceiveAncestorInsertEvents);
        for (const descendant of descendantsListeningForEvent)
            descendant.component?.event.emit('ancestorInsert');
        for (const descendant of component.element.getElementsByClassName(Classes.HasRect))
            ComponentPerf.Rect(descendant.component)?.markDirty();
        for (const descendant of component.element.getElementsByClassName(Classes.HasStatesToMarkDirtyOnInsertions))
            for (const callback of ComponentPerf.CallbacksOnInsertions.get(descendant.component))
                callback();
        let cursor = component.element.parentElement;
        while (cursor) {
            if (cursor.classList.contains(Classes.ReceiveDescendantInsertEvents))
                cursor.component?.event.emit('descendantInsert');
            cursor = cursor.parentElement;
        }
    }
    function updateRooted(component) {
        if (component) {
            const rooted = document.documentElement.contains(component.element);
            if (component.rooted.value === rooted)
                return;
            component.rooted.asMutable?.setValue(rooted);
            if (component.classes.has(Classes.ReceiveRootedEvents))
                component.event.emit(rooted ? 'root' : 'unroot');
            for (const descendant of component.element.querySelectorAll('*')) {
                const component = descendant.component;
                if (component) {
                    component.rooted.asMutable?.setValue(rooted);
                    if (component.classes.has(Classes.ReceiveRootedEvents))
                        component.event.emit(rooted ? 'root' : 'unroot');
                }
            }
        }
    }
    function emitRemove(component) {
        if (!component)
            return;
        let cursor = component.element.parentElement;
        while (cursor) {
            if (cursor.classList.contains(Classes.ReceiveDescendantRemoveEvents))
                cursor.component?.event.emit('descendantRemove');
            cursor = cursor.parentElement;
        }
    }
    let canBuildComponents = false;
    (function (Component) {
        let bodyComponent, documentComponent, windowComponent;
        Component.getBody = () => bodyComponent ??= wrap(document.body);
        Component.getDocument = () => documentComponent ??= wrap(document.documentElement);
        Component.getWindow = () => windowComponent ??= wrap(window);
        function setComponentLibrarySource(source) {
            selfScript.value = source;
        }
        Component.setComponentLibrarySource = setComponentLibrarySource;
        let stackSupplier;
        function setStackSupplier(_stackSupplier) {
            stackSupplier = _stackSupplier;
        }
        Component.setStackSupplier = setStackSupplier;
        function allowBuilding() {
            canBuildComponents = true;
        }
        Component.allowBuilding = allowBuilding;
        function is(value) {
            return typeof value === 'object' && !!value?.isComponent;
        }
        Component.is = is;
        function element(from) {
            return is(from) ? from.element : from;
        }
        Component.element = element;
        function wrap(element) {
            const component = Component();
            (0, Objects_2.mutable)(component).element = element;
            component.rooted.asMutable?.setValue(element === window || element === document || document.contains(element));
            return component;
        }
        Component.wrap = wrap;
        Component.SYMBOL_COMPONENT_TYPE_BRAND = Symbol('COMPONENT_TYPE_BRAND');
        const SYMBOL_EXTENSIONS_APPLIED = Symbol('EXTENSIONS_APPLIED');
        const defaultBuilder = (type) => Component(type);
        function Builder(initialOrBuilder, builder) {
            let name = getBuilderName();
            const type = typeof initialOrBuilder === 'string' ? initialOrBuilder : undefined;
            const initialBuilder = !builder || typeof initialOrBuilder === 'string' ? defaultBuilder : initialOrBuilder;
            builder ??= initialOrBuilder;
            const realBuilder = (component = initialBuilder(type), ...params) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const result = builder(component, ...params);
                if (result instanceof Promise)
                    return result.then(result => {
                        if (result !== component)
                            void ensureOriginalComponentNotSubscriptionOwner(component);
                        return applyExtensions(result);
                    });
                if (result !== component)
                    void ensureOriginalComponentNotSubscriptionOwner(component);
                return applyExtensions(result);
            };
            const simpleBuilder = (...params) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const component = realBuilder(undefined, ...params);
                if (component instanceof Promise)
                    return component.then(applyExtensions).then(completeComponent);
                return completeComponent(applyExtensions(component));
            };
            Object.defineProperty(builder, 'name', { value: name, configurable: true });
            Object.defineProperty(builder, Symbol.toStringTag, { value: name, configurable: true });
            Object.defineProperty(realBuilder, 'name', { value: name, configurable: true });
            Object.defineProperty(realBuilder, Symbol.toStringTag, { value: name, configurable: true });
            Object.defineProperty(simpleBuilder, 'name', { value: name, configurable: true });
            Object.defineProperty(simpleBuilder, Symbol.toStringTag, { value: name, configurable: true });
            const extensions = [];
            // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
            const styleTargets = (style) => {
                extensions.push(component => {
                    component.styleTargets(style);
                });
                return resultBuilder;
            };
            const resultBuilder = Object.assign(simpleBuilder, {
                from: realBuilder,
                setName(newName) {
                    name = addKebabCase(newName);
                    Object.defineProperty(simpleBuilder, 'name', { value: name });
                    return resultBuilder;
                },
                extend(extensionProvider) {
                    extensions.push(extensionProvider);
                    return resultBuilder;
                },
                styleTargets: styleTargets,
                styleTargetsPartial: styleTargets,
            });
            return resultBuilder;
            function applyExtensions(component) {
                if (!component)
                    return component;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const editableComponent = component;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                let extensionsApplied = editableComponent[SYMBOL_EXTENSIONS_APPLIED];
                if (extensionsApplied?.includes(realBuilder))
                    return component;
                for (const extension of extensions)
                    Object.assign(component, extension(component));
                if (!extensionsApplied)
                    Object.defineProperty(component, SYMBOL_EXTENSIONS_APPLIED, { value: extensionsApplied = [] });
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                editableComponent[SYMBOL_EXTENSIONS_APPLIED].push(realBuilder);
                return component;
            }
            function completeComponent(component) {
                if (!component)
                    return component;
                if (name) {
                    component[Symbol.toStringTag] ??= name.toString();
                    const tagName = `:${name.kebabcase}`;
                    if (component.element.tagName === 'SPAN') {
                        component.replaceElement(tagName);
                    }
                    else {
                        component.attributes.prepend(tagName);
                    }
                }
                component.supers.value.push(simpleBuilder);
                component.supers.emit();
                return component;
            }
            async function ensureOriginalComponentNotSubscriptionOwner(original) {
                if (!original || !State_10.default.OwnerMetadata.hasSubscriptions(original))
                    return;
                const originalRef = new WeakRef(original);
                original = undefined;
                await new Promise(resolve => setTimeout(resolve, 1000));
                original = originalRef.deref();
                if (!original || original.rooted.value || original.removed.value)
                    return;
                console.error(`${String(name ?? 'Component')} builder returned a replacement component, but the original component was used as a subscription owner and is not in the tree!`);
            }
        }
        Component.Builder = Builder;
        function Extension(builder) {
            return {
                name: getBuilderName(),
                from: builder,
                setName(newName) {
                    (0, Objects_2.mutable)(this).name = addKebabCase(newName);
                    return this;
                },
            };
        }
        Component.Extension = Extension;
        function Tag() {
            return Extension(component => component);
        }
        Component.Tag = Tag;
        function extend(extension) {
            componentExtensionsRegistry.push(extension);
        }
        Component.extend = extend;
        /**
         * Returns the component for the given element, if it exists
         */
        function get(element) {
            if (!element || (typeof element !== 'object' && typeof element !== 'function'))
                return undefined;
            return is(element) ? element : ELEMENT_TO_COMPONENT_MAP.get(element);
        }
        Component.get = get;
        // const STACK_FILE_NAME_REGEX = /\(http.*?(\w+)\.ts:\d+:\d+\)/
        const STACK_FILE_LINE_REGEX = /\(http.*?\w+\.[tj]s:(\d+):\d+\)|@http.*?\w+\.[tj]s:(\d+):\d+/;
        const VARIABLE_NAME_REGEX = /\s*(?:const |exports\.(?!default))(\w+) = /;
        const LAST_MODULE_DEF_REGEX = /.*\bdefine\("(?:[^"]+\/)*(\w+)", /s;
        const PASCAL_CASE_WORD_START = /(?<=[a-z0-9_-])(?=[A-Z])/g;
        function addKebabCase(name) {
            return Object.assign(String(name), {
                kebabcase: name.replaceAll(PASCAL_CASE_WORD_START, '-').toLowerCase(),
            });
        }
        // let logNode: HTMLElement | undefined
        let indexjsText;
        let lines;
        function getBuilderName() {
            let moduleName = '__moduleName' in self ? self.__moduleName : undefined;
            if (moduleName)
                return addKebabCase(moduleName.slice(moduleName.lastIndexOf('/') + 1));
            if (!lines) {
                indexjsText ??= document.currentScript?.text ?? selfScript.value;
                if (!indexjsText)
                    return undefined;
                lines = indexjsText.split('\n');
            }
            // if (!logNode) {
            // 	logNode = document.createElement('div')
            // 	document.body.prepend(logNode)
            // }
            const rawStack = stackSupplier?.() ?? new Error().stack ?? '';
            const stack = Strings_2.default.shiftLine(rawStack, rawStack.includes('@') ? 2 : 3); // handle safari stack traces (@)
            // logNode.append(document.createTextNode(`original stack ${new Error().stack}`), document.createElement('br'))
            // logNode.append(document.createTextNode(`shifted stack ${stack}`), document.createElement('br'))
            const lineMatch = stack.match(STACK_FILE_LINE_REGEX);
            const line = Number(lineMatch?.[1] ?? lineMatch?.[2]);
            const lineText = lines[line - 1];
            // logNode.append(document.createTextNode(`found ${lineMatch?.[1] ?? lineMatch?.[2]} ${line} ${lineText}`))
            // logNode.append(document.createElement('br'), document.createElement('br'))
            if (!lineText)
                return undefined;
            const varName = lineText.match(VARIABLE_NAME_REGEX)?.[1];
            if (varName)
                return addKebabCase(varName);
            const sliceUntilLine = indexjsText.slice(0, indexjsText.indexOf(lineText));
            moduleName = sliceUntilLine.match(LAST_MODULE_DEF_REGEX)?.[1];
            if (!moduleName)
                return undefined;
            return addKebabCase(moduleName);
        }
        function removeContents(element) {
            for (const child of [...element.childNodes]) {
                if (child.component)
                    child.component.remove();
                else {
                    removeContents(child);
                    child.remove();
                }
            }
        }
        Component.removeContents = removeContents;
        function closest(builder, element) {
            let cursor = is(element) ? element.element : element ?? null;
            while (cursor) {
                const component = cursor?.component;
                if (component?.is(builder))
                    return component;
                cursor = cursor.parentElement;
            }
        }
        Component.closest = closest;
        function findAll(builder, element) {
            const components = [];
            const cursor = is(element) ? element.element : element ?? null;
            if (cursor) {
                const walker = document.createTreeWalker(cursor, NodeFilter.SHOW_ELEMENT);
                let node;
                while ((node = walker.nextNode())) {
                    const component = node.component;
                    if (component?.is(builder))
                        components.push(component);
                }
            }
            return components;
        }
        Component.findAll = findAll;
    })(Component || (Component = {}));
    exports.default = Component;
});
define("kitsui/component/Dialog", ["require", "exports", "kitsui/Component", "kitsui/utility/State"], function (require, exports, Component_2, State_11) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Component_2 = __importDefault(Component_2);
    State_11 = __importDefault(State_11);
    const OPEN_DIALOGS = new Set();
    function addOpenDialog(dialog) {
        const hadOpenDialogs = !!OPEN_DIALOGS.size;
        OPEN_DIALOGS.add(dialog);
        if (!hadOpenDialogs)
            Component_2.default.getDocument().style.setProperty('overflow', 'hidden');
    }
    function removeOpenDialog(dialog) {
        OPEN_DIALOGS.delete(dialog);
        if (!OPEN_DIALOGS.size)
            Component_2.default.getDocument().style.removeProperties('overflow');
    }
    var DialogStyleTargets;
    (function (DialogStyleTargets) {
        DialogStyleTargets[DialogStyleTargets["Dialog"] = 0] = "Dialog";
        DialogStyleTargets[DialogStyleTargets["Dialog_Open"] = 1] = "Dialog_Open";
    })(DialogStyleTargets || (DialogStyleTargets = {}));
    const Dialog = Object.assign(Component_2.default.Builder(() => {
        const opened = (0, State_11.default)(false);
        const willOpen = (0, State_11.default)(false);
        const willClose = (0, State_11.default)(false);
        let modal = true;
        let unbind;
        const dialog = (0, Component_2.default)('dialog')
            .addStyleTargets(DialogStyleTargets);
        const style = dialog.styleTargets;
        dialog.style(style.Dialog)
            .style.bind(opened, style.Dialog_Open);
        return dialog.extend(dialog => ({
            opened,
            willClose,
            willOpen,
            setNotModal: (notModal = true) => {
                modal = !notModal;
                dialog.style.toggleProperty(notModal, 'position', 'fixed');
                dialog.style.toggleProperty(notModal, 'inset', 'auto');
                dialog.style.toggleProperty(notModal, 'z-index', '99999999999');
                return dialog;
            },
            setFullscreen: (fullscreen = true) => {
                dialog.style.toggleProperty(fullscreen, 'width', '100%');
                dialog.style.toggleProperty(fullscreen, 'height', '100%');
                dialog.style.toggleProperty(fullscreen, 'inset', '0');
                return dialog;
            },
            open: () => {
                willOpen.value = true;
                if (!dialog.willOpen.value)
                    return dialog;
                unbind?.();
                addOpenDialog(dialog);
                dialog.element[modal ? 'showModal' : 'show']();
                opened.value = true;
                willOpen.value = false;
                return dialog;
            },
            close: () => {
                willClose.value = true;
                if (!dialog.willClose.value)
                    return dialog;
                unbind?.();
                removeOpenDialog(dialog);
                dialog.element.close();
                opened.value = false;
                willClose.value = false;
                return dialog;
            },
            toggle: (open = !dialog.opened.value) => {
                const willChangeStateName = open ? 'willOpen' : 'willClose';
                dialog[willChangeStateName].asMutable?.setValue(true);
                if (!dialog[willChangeStateName].value)
                    return dialog;
                unbind?.();
                if (open) {
                    addOpenDialog(dialog);
                    dialog.element[modal ? 'showModal' : 'show']();
                }
                else {
                    removeOpenDialog(dialog);
                    dialog.element.close();
                }
                opened.value = open ?? !opened.value;
                dialog[willChangeStateName].asMutable?.setValue(false);
                return dialog;
            },
            bind: state => {
                unbind?.();
                unbind = state.use(dialog, open => {
                    const willChangeStateName = open ? 'willOpen' : 'willClose';
                    dialog[willChangeStateName].asMutable?.setValue(true);
                    if (open) {
                        addOpenDialog(dialog);
                        dialog.element[modal ? 'showModal' : 'show']();
                    }
                    else {
                        removeOpenDialog(dialog);
                        dialog.element.close();
                    }
                    opened.value = open;
                    dialog[willChangeStateName].asMutable?.setValue(false);
                });
                return dialog;
            },
            unbind: () => {
                unbind?.();
                return dialog;
            },
        }));
    }), {
        await(dialog) {
            let remove = false;
            if (!dialog.rooted.value) {
                remove = true;
                dialog.appendTo(document.body);
            }
            return new Promise(resolve => {
                dialog.open();
                dialog.event.subscribe('close', event => {
                    event.host.event.subscribe('transitionend', () => {
                        if (remove)
                            dialog.remove();
                        resolve();
                    });
                });
            });
        },
        forceCloseAll() {
            for (const dialog of OPEN_DIALOGS)
                dialog.close();
        },
    });
    exports.default = Dialog;
});
define("kitsui/component/Loading", ["require", "exports", "kitsui/Component", "kitsui/utility/State"], function (require, exports, Component_3, State_12) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Component_3 = __importDefault(Component_3);
    State_12 = __importDefault(State_12);
    var LoadingStyleTargets;
    (function (LoadingStyleTargets) {
        LoadingStyleTargets[LoadingStyleTargets["Loading"] = 0] = "Loading";
        LoadingStyleTargets[LoadingStyleTargets["LoadingLoaded"] = 1] = "LoadingLoaded";
        LoadingStyleTargets[LoadingStyleTargets["Spinner"] = 2] = "Spinner";
        LoadingStyleTargets[LoadingStyleTargets["ProgressBar"] = 3] = "ProgressBar";
        LoadingStyleTargets[LoadingStyleTargets["ProgressBarProgressUnknown"] = 4] = "ProgressBarProgressUnknown";
        LoadingStyleTargets[LoadingStyleTargets["MessageText"] = 5] = "MessageText";
        LoadingStyleTargets[LoadingStyleTargets["ErrorIcon"] = 6] = "ErrorIcon";
        LoadingStyleTargets[LoadingStyleTargets["ErrorText"] = 7] = "ErrorText";
    })(LoadingStyleTargets || (LoadingStyleTargets = {}));
    const Loading = (0, Component_3.default)((component) => {
        const loading = component.addStyleTargets(LoadingStyleTargets);
        const style = loading.styleTargets;
        const storage = (0, Component_3.default)().setOwner(component);
        const spinner = (0, Component_3.default)().style(style.Spinner);
        const progressBar = (0, Component_3.default)().style(style.ProgressBar);
        const messageText = (0, Component_3.default)().style(style.MessageText);
        const errorIcon = (0, Component_3.default)().style(style.ErrorIcon);
        const errorText = (0, Component_3.default)().style(style.ErrorText);
        const loaded = (0, State_12.default)(false);
        let owner;
        let refresh;
        const onSetHandlers = [];
        const onLoadHandlers = [];
        return loading.style(style.Loading)
            .extend(loading => ({
            spinner,
            progressBar,
            messageText,
            errorIcon,
            errorText,
            loaded,
            refresh() {
                refresh?.();
                return this;
            },
            showForever() {
                return this.set(State_12.default.Async(State_12.default.Owner.create(), async () => { await new Promise(resolve => { }); }), () => { });
            },
            set(stateIn, initialiser) {
                owner?.remove();
                owner = State_12.default.Owner.create();
                const thisSetOwner = owner;
                loading.rooted.match(thisSetOwner, true, () => {
                    const owner = thisSetOwner;
                    loaded.value = false;
                    const state = typeof stateIn !== 'function' ? stateIn : State_12.default.Async(owner, stateIn);
                    refresh = state.refresh;
                    updateDisplays();
                    state.settled.subscribe(owner, updateDisplays);
                    state.progress.subscribe(owner, updateDisplays);
                    state.state.use(owner, state => {
                        if (!state.settled) {
                            clearContents();
                            loading.append(spinner, progressBar, messageText);
                            return;
                        }
                        if (state.error) {
                            clearContents();
                            loading.append(errorIcon, errorText);
                            return;
                        }
                        let loadHandlerIndex = 0;
                        function runNextLoadHandler() {
                            const loadHandler = onLoadHandlers[loadHandlerIndex];
                            if (!loadHandler) {
                                clearContents();
                                loaded.value = true;
                                initialiser(loading, state.value);
                                return;
                            }
                            loadHandlerIndex++;
                            return loadHandler(loading, runNextLoadHandler);
                        }
                        runNextLoadHandler();
                    });
                    for (const handler of onSetHandlers)
                        handler(loading, owner, state);
                    return;
                    function clearContents() {
                        storage.append(spinner, progressBar, messageText, errorIcon, errorText);
                        loading.removeContents();
                    }
                    function updateDisplays() {
                        loading.style.bind(state.settled.value, style.LoadingLoaded);
                        messageText.text.set(state.progress.value?.details);
                        progressBar
                            .style.bind(state.progress.value?.progress === null, style.ProgressBarProgressUnknown)
                            .style.setVariable('progress', state.progress.value?.progress ?? 1);
                    }
                });
                return loading;
            },
            onSet(handler) {
                onSetHandlers.push(handler);
                return loading;
            },
            onLoad(handler) {
                onLoadHandlers.push(handler);
                return loading;
            },
        }))
            .onRemoveManual(() => {
            owner?.remove();
            owner = undefined;
            refresh = undefined;
        });
    });
    exports.default = Loading;
});
define("kitsui/utility/HoverListener", ["require", "exports", "kitsui/utility/Arrays", "kitsui/utility/Mouse"], function (require, exports, Arrays_6, Mouse_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Arrays_6 = __importDefault(Arrays_6);
    Mouse_2 = __importDefault(Mouse_2);
    var HoverListener;
    (function (HoverListener) {
        let lastHovered = [];
        function allHovered() {
            return lastHovered;
        }
        HoverListener.allHovered = allHovered;
        function hovered() {
            return lastHovered.at(-1);
        }
        HoverListener.hovered = hovered;
        function* allHoveredComponents() {
            for (const element of lastHovered) {
                const component = element.component;
                if (component)
                    yield component;
            }
        }
        HoverListener.allHoveredComponents = allHoveredComponents;
        function hoveredComponent() {
            return lastHovered.at(-1)?.component;
        }
        HoverListener.hoveredComponent = hoveredComponent;
        function listen() {
            Mouse_2.default.onMove((event, allHovered) => {
                const hovered = allHovered.at(-1);
                if (hovered && (hovered.clientWidth === 0 || hovered.clientHeight === 0))
                    Arrays_6.default.filterInPlace(allHovered, element => element.computedStyleMap().get('display')?.toString() !== 'none');
                if (hovered === lastHovered.at(-1))
                    return;
                const newHovered = allHovered;
                const noLongerHovering = lastHovered.filter(element => !newHovered.includes(element));
                for (const element of noLongerHovering)
                    if (element.component)
                        element.component.hoveredTime.asMutable?.setValue(undefined);
                const nowHovering = newHovered.filter(element => !lastHovered.includes(element));
                for (const element of nowHovering)
                    if (element.component)
                        element.component.hoveredTime.asMutable?.setValue(Date.now());
                lastHovered = newHovered;
            });
        }
        HoverListener.listen = listen;
    })(HoverListener || (HoverListener = {}));
    exports.default = HoverListener;
    Object.assign(window, { HoverListener });
});
define("kitsui/utility/InputBus", ["require", "exports", "kitsui/Component", "kitsui/utility/EventManipulator"], function (require, exports, Component_4, EventManipulator_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.HandlesMouseEvents = exports.HandlesKeyboardEvents = void 0;
    Component_4 = __importDefault(Component_4);
    EventManipulator_2 = __importDefault(EventManipulator_2);
    var Classes;
    (function (Classes) {
        Classes["ReceiveFocusedClickEvents"] = "_receieve-focused-click-events";
    })(Classes || (Classes = {}));
    Component_4.default.extend(component => {
        component.extend(component => ({
            receiveFocusedClickEvents: () => component.classes.add(Classes.ReceiveFocusedClickEvents),
        }));
    });
    exports.HandlesKeyboardEvents = Component_4.default.Tag().setName('HandlesKeyboardEvents');
    exports.HandlesMouseEvents = Component_4.default.Tag().setName('HandlesMouseEvents');
    const MOUSE_KEYNAME_MAP = {
        [0]: 'MouseLeft',
        [1]: 'MouseMiddle',
        [2]: 'MouseRight',
        [3]: 'Mouse3',
        [4]: 'Mouse4',
        [5]: 'Mouse5',
        [`${undefined}`]: 'Mouse?',
    };
    let lastUsed = 0;
    const inputDownTime = {};
    const InputBus = Object.assign({
        getPressStart: (name) => inputDownTime[name],
        getPressDuration: (name) => inputDownTime[name] === undefined ? undefined : Date.now() - inputDownTime[name],
        isDown: (name) => !!inputDownTime[name],
        isUp: (name) => !inputDownTime[name],
    }, {
        event: (0, EventManipulator_2.default)({}),
    });
    function emitKeyEvent(e) {
        const target = e.target;
        const input = target?.closest('input[type=text], textarea, [contenteditable]') ?? null;
        let usedByInput = !!input;
        const isClick = true
            && !usedByInput
            && e.type === 'keydown'
            && (e.key === 'Enter' || e.key === ' ')
            && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey
            && !!target?.classList.contains(Classes.ReceiveFocusedClickEvents);
        if (isClick) {
            const result = target?.component?.event.emit('click');
            if (result?.stoppedPropagation === true)
                e.stopPropagation();
            else if (result?.stoppedPropagation === 'immediate')
                e.stopImmediatePropagation();
            if (result?.defaultPrevented) {
                e.preventDefault();
                return;
            }
        }
        const eventKey = e.key ?? MOUSE_KEYNAME_MAP[e.button];
        const eventType = e.type === 'mousedown' ? 'keydown' : e.type === 'mouseup' ? 'keyup' : e.type;
        if (eventType === 'keydown' && !inputDownTime[eventKey])
            inputDownTime[eventKey] = Date.now();
        let cancelInput = false;
        const event = {
            key: eventKey,
            ctrl: e.ctrlKey,
            shift: e.shiftKey,
            alt: e.altKey,
            used: usedByInput,
            input,
            targetElement: target,
            targetComponent: target?.component ?? null,
            use: (key, ...modifiers) => {
                if (event.used)
                    return false;
                const matches = event.matches(key, ...modifiers);
                if (matches)
                    event.used = true;
                return matches;
            },
            useOverInput: (key, ...modifiers) => {
                if (event.used && !usedByInput)
                    return false;
                const matches = event.matches(key, ...modifiers);
                if (matches) {
                    event.used = true;
                    usedByInput = false;
                }
                return matches;
            },
            matches: (key, ...modifiers) => {
                if (eventKey !== key)
                    return false;
                if (!modifiers.every(modifier => event[modifier]))
                    return false;
                return true;
            },
            cancelInput: () => cancelInput = true,
            hovering: selector => {
                const hovered = [...document.querySelectorAll(':hover')];
                return selector ? hovered[hovered.length - 1]?.closest(selector) ?? undefined : hovered[hovered.length - 1];
            },
        };
        if (eventType === 'keyup') {
            event.usedAnotherKeyDuring = lastUsed > (inputDownTime[eventKey] ?? 0);
            delete inputDownTime[eventKey];
        }
        InputBus.event.emit(eventType === 'keydown' ? 'Down' : 'Up', event);
        if ((event.used && !usedByInput) || (usedByInput && cancelInput)) {
            e.preventDefault();
            lastUsed = Date.now();
        }
        if (usedByInput) {
            if (e.type === 'keydown' && eventKey === 'Enter' && !event.shift && !event.alt) {
                const form = target?.closest('form');
                if (form && (target?.tagName.toLowerCase() === 'input' || target?.closest('[contenteditable]')) && !event.ctrl) {
                    if (!Component_4.default.closest(exports.HandlesKeyboardEvents, target))
                        e.preventDefault();
                }
                else {
                    form?.requestSubmit();
                }
            }
        }
    }
    document.addEventListener('keydown', emitKeyEvent, { capture: true });
    document.addEventListener('keyup', emitKeyEvent, { capture: true });
    document.addEventListener('mousedown', emitKeyEvent);
    document.addEventListener('mouseup', emitKeyEvent);
    document.addEventListener('click', emitKeyEvent);
    Object.defineProperty(MouseEvent.prototype, 'used', {
        get() {
            return this._used ?? false;
        },
    });
    Object.defineProperty(MouseEvent.prototype, 'use', {
        value: function (key, ...modifiers) {
            if (this._used)
                return false;
            const matches = this.matches(key, ...modifiers);
            if (matches) {
                this._used = true;
                // allow click & contextmenu handlers to be considered "used" for IKeyUpEvents
                lastUsed = Date.now();
            }
            return matches;
        },
    });
    Object.defineProperty(MouseEvent.prototype, 'matches', {
        value: function (key, ...modifiers) {
            if (MOUSE_KEYNAME_MAP[this.button] !== key)
                return false;
            if (!modifiers.every(modifier => this[`${modifier}Key`]))
                return false;
            return true;
        },
    });
    exports.default = InputBus;
});
define("kitsui/utility/Task", ["require", "exports", "kitsui/utility/Time"], function (require, exports, Time_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Time_2 = __importDefault(Time_2);
    const DEFAULT_INTERVAL = Time_2.default.seconds(1) / 144;
    class Task {
        interval;
        static async yield(instantIfUnsupported = false) {
            if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function')
                return scheduler.yield();
            if (!instantIfUnsupported)
                await new Promise(resolve => setTimeout(resolve, 0));
        }
        static post(callback, priority) {
            if (typeof scheduler === 'undefined' || typeof scheduler.postTask !== 'function')
                return callback();
            return scheduler.postTask(callback, { priority });
        }
        lastYieldEnd = Date.now();
        constructor(interval = DEFAULT_INTERVAL) {
            this.interval = interval;
        }
        reset() {
            this.lastYieldEnd = Date.now();
        }
        async yield(instantIfUnsupported = false) {
            if (Date.now() - this.lastYieldEnd > this.interval) {
                await Task.yield(instantIfUnsupported);
                this.lastYieldEnd = Date.now();
            }
        }
    }
    exports.default = Task;
});
define("kitsui/component/Popover", ["require", "exports", "kitsui/Component", "kitsui/component/Dialog", "kitsui/utility/FocusListener", "kitsui/utility/HoverListener", "kitsui/utility/InputBus", "kitsui/utility/Mouse", "kitsui/utility/Objects", "kitsui/utility/State", "kitsui/utility/Task", "kitsui/utility/Vector2", "kitsui/utility/Viewport"], function (require, exports, Component_5, Dialog_1, FocusListener_2, HoverListener_1, InputBus_1, Mouse_3, Objects_3, State_13, Task_1, Vector2_1, Viewport_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Component_5 = __importStar(Component_5);
    Dialog_1 = __importDefault(Dialog_1);
    FocusListener_2 = __importDefault(FocusListener_2);
    HoverListener_1 = __importDefault(HoverListener_1);
    InputBus_1 = __importStar(InputBus_1);
    Mouse_3 = __importDefault(Mouse_3);
    State_13 = __importDefault(State_13);
    Task_1 = __importDefault(Task_1);
    Vector2_1 = __importDefault(Vector2_1);
    Viewport_3 = __importDefault(Viewport_3);
    var FocusTrap;
    (function (FocusTrap) {
        let component;
        function get() {
            return component ??= (0, Component_5.default)()
                .tabIndex('auto')
                .ariaHidden()
                .style.setProperties({
                position: 'fixed',
                display: 'none',
            })
                .prependTo(document.body);
        }
        function show() {
            get().style.setProperty('display', 'inline');
        }
        FocusTrap.show = show;
        function hide() {
            get().style.setProperty('display', 'none');
        }
        FocusTrap.hide = hide;
    })(FocusTrap || (FocusTrap = {}));
    const PopoverHost = Component_5.default.Tag();
    Component_5.default.extend(component => {
        component.extend((component) => ({
            hasPopoverSet() {
                return !!component.popover;
            },
            clearPopover: () => component
                .attributes.set('data-clear-popover', 'true'),
            setPopover: (popoverEvent, initialiserOrPopover) => {
                component.and(PopoverHost);
                if (component.popover)
                    component.popover.remove();
                const popoverIn = Component_5.default.is(initialiserOrPopover) ? initialiserOrPopover : undefined;
                const initialiser = Component_5.default.is(initialiserOrPopover) ? undefined : initialiserOrPopover;
                if (popoverIn && popoverIn.hasOwner()) {
                    console.log('Detaching popover from owner', popoverIn);
                    popoverIn.setOwner(undefined);
                }
                component.style.setProperties({
                    ['-webkitTouchCallout']: 'none',
                    userSelect: 'none',
                });
                let isShown = false;
                const popover = popoverIn ?? Popover()
                    .anchor.from(component)
                    .tweak(popover => popover
                    .prepend((0, Component_5.default)()
                    .style(popover.styleTargets.PopoverCloseSurface)
                    .event.subscribe('click', () => popover.hide())))
                    .setOwner(component)
                    .setCloseDueToMouseInputFilter(event => {
                    const hovered = HoverListener_1.default.hovered() ?? null;
                    if (component.element.contains(hovered))
                        return false;
                    return true;
                })
                    .event.subscribe('toggle', e => {
                    if (!popover.element.matches(':popover-open')) {
                        isShown = false;
                        component.clickState = false;
                        Mouse_3.default.offMove(updatePopoverState);
                    }
                })
                    .tweak(initialiser, component)
                    .tweak(popover => {
                    popover.visible.match(popover, true, async () => {
                        if (popover.hasContent()) {
                            popover.style.setProperty('visibility', 'hidden');
                            popover.show();
                            await Task_1.default.yield();
                            popover.anchor.apply();
                            await Task_1.default.yield();
                            popover.anchor.markDirty();
                            popover.style.removeProperties('visibility');
                        }
                    });
                    popover.style.bind(popover.anchor.state.mapManual(location => location?.preference?.yAnchor.side === 'bottom'), popover.styleTargets.Popover_AnchoredTop);
                    popover.style.bind(popover.anchor.state.mapManual(location => location?.preference?.xAnchor.side === 'left'), popover.styleTargets.Popover_AnchoredLeft);
                });
                const combinedOwner = State_13.default.Owner.getCombined(component, popover);
                if (!popoverIn)
                    component.getStateForClosest(Dialog_1.default)
                        .map(popover, dialog => dialog ?? document.body)
                        .use(popover, parent => popover.appendTo(parent));
                let touchTimeout;
                let touchStart;
                let longpressed = false;
                function cancelLongpress() {
                    longpressed = false;
                    touchStart = undefined;
                    clearTimeout(touchTimeout);
                }
                component.event.until(combinedOwner, event => event
                    .subscribe('touchstart', event => {
                    touchStart = Vector2_1.default.fromClient(event.touches[0]);
                    if (event.touches.length > 1)
                        return cancelLongpress();
                    const closestWithPopover = [
                        event.targetComponent,
                        ...event.targetComponent?.getAncestorComponents() ?? [],
                    ]
                        .find(component => component?.hasPopoverSet());
                    ////////////////////////////////////
                    //#region Debugging
                    // function useError (supplier: () => unknown) {
                    // 	try {
                    // 		return supplier()
                    // 	}
                    // 	catch (e) {
                    // 		return e instanceof Error ? e.message : String(e)
                    // 	}
                    // }
                    // Component('pre')
                    // 	.style.setProperties({
                    // 		position: 'relative',
                    // 		zIndex: '2',
                    // 		background: '#222',
                    // 		color: '#aaa',
                    // 		fontSize: 'var(--font-0)',
                    // 		whiteSpace: 'pre-wrap',
                    // 	})
                    // 	.text.set(Object
                    // 		.entries({
                    // 			eventPopoverHost: component?.fullType,
                    // 			...(event.targetComponent === component
                    // 				? { targetIsEventHost: true }
                    // 				: {
                    // 					targetIsEventHost: false,
                    // 					target: event.targetComponent?.fullType,
                    // 					...(closestWithPopover === component
                    // 						? { closestIsEventHost: true }
                    // 						: {
                    // 							closestIsEventHost: false,
                    // 							closestPopoverHost: closestWithPopover?.fullType,
                    // 						}
                    // 					),
                    // 				}
                    // 			),
                    // 		})
                    // 		.map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
                    // 		.join('\n')
                    // 	)
                    // 	.appendTo(component)
                    //#endregion
                    ////////////////////////////////////
                    if (closestWithPopover !== component)
                        return;
                    touchTimeout = window.setTimeout(() => {
                        longpressed = true;
                        void updatePopoverState(null, null, 'longpress');
                    }, 800);
                })
                    .subscribePassive('touchmove', event => {
                    if (!touchStart)
                        return;
                    if (event.touches.length > 1)
                        return cancelLongpress();
                    const newPosition = Vector2_1.default.fromClient(event.touches[0]);
                    if (!Vector2_1.default.distanceWithin(20, touchStart, newPosition))
                        return cancelLongpress();
                })
                    .subscribe('touchend', event => {
                    if (longpressed)
                        event.preventDefault();
                    cancelLongpress();
                }));
                const hostHoveredOrFocusedForLongEnough = component.hoveredOrFocused.delay(combinedOwner, hoveredOrFocused => {
                    if (!hoveredOrFocused)
                        return 0; // no delay for mouseoff or blur
                    return popover.getDelay();
                });
                if ((popoverEvent === 'hover/click' || popoverEvent === 'hover/longpress') && !component.popover)
                    hostHoveredOrFocusedForLongEnough.subscribe(component, updatePopoverState);
                component.clickState = false;
                if (!component.popover) {
                    component.event.until(combinedOwner, event => event
                        .subscribe('click', async (event) => {
                        if (popoverEvent === 'hover/longpress')
                            return;
                        const closestHandlesMouseEvents = event.target.component?.closest(InputBus_1.HandlesMouseEvents);
                        if (closestHandlesMouseEvents && closestHandlesMouseEvents?.element !== component.element && component.element.contains(closestHandlesMouseEvents.element))
                            return;
                        component.clickState = !component.clickState;
                        event.stopPropagation();
                        event.preventDefault();
                        if (component.clickState)
                            await showPopoverClick();
                        else
                            popover.hide();
                    }));
                    Component_5.ComponentPerf.CallbacksOnInsertions.add(component, updatePopoverParent);
                    // component.receiveInsertEvents()
                    // component.receiveAncestorInsertEvents()
                    // component.event.subscribe(['insert', 'ancestorInsert'], updatePopoverParent)
                }
                popover.popoverHasFocus.subscribe(combinedOwner, (hasFocused, oldValue) => {
                    if (hasFocused)
                        return;
                    component.clickState = false;
                    component.popover?.hide();
                    if (oldValue !== 'no-focus')
                        component.focus();
                });
                return component.extend(component => ({
                    popover,
                    popoverDescendants: [],
                    tweakPopover: initialiser => {
                        initialiser(component.popover, component);
                        return component;
                    },
                    showPopover: () => {
                        void showPopoverClick();
                        return component;
                    },
                    togglePopover: () => {
                        if (popover.visible.value)
                            popover.hide();
                        else
                            void showPopoverClick();
                        return component;
                    },
                }));
                async function showPopoverClick() {
                    popover.anchor.from(component);
                    popover.style.setProperty('visibility', 'hidden');
                    popover.show();
                    popover.focus();
                    popover.style.removeProperties('left', 'top');
                    await Task_1.default.yield();
                    popover.anchor.apply();
                    await Task_1.default.yield();
                    popover.anchor.markDirty();
                    popover.style.removeProperties('visibility');
                }
                function updatePopoverParent() {
                    if (!component.popover)
                        return;
                    const oldParent = component.popover.popoverParent.value;
                    component.popover.popoverParent.asMutable?.setValue(component.closest(Popover));
                    if (oldParent && oldParent !== component.popover.popoverParent.value)
                        oldParent.popoverChildren.asMutable?.setValue(oldParent.popoverChildren.value.filter(c => c !== component.popover));
                    if (component.popover.popoverParent.value && component.popover.popoverParent.value !== oldParent)
                        component.popover.popoverParent.value.popoverChildren.asMutable?.setValue([...component.popover.popoverParent.value.popoverChildren.value, component.popover]);
                }
                async function updatePopoverState(_1, _2, reason) {
                    if (!component.popover)
                        return;
                    const shouldShow = false
                        || (hostHoveredOrFocusedForLongEnough.value && !Viewport_3.default.tablet.value)
                        || reason === 'longpress'
                        || (true
                            && isShown
                            && (false
                                || (component.popover.isMouseWithin(true) && !shouldClearPopover())
                                || InputBus_1.default.isDown('F4')))
                        || !!component.clickState;
                    ////////////////////////////////////
                    //#region Debugging
                    // Component('pre')
                    // 	.style.setProperties({
                    // 		fontSize: 'var(--font-0)',
                    // 		whiteSpace: 'pre-wrap',
                    // 	})
                    // 	.text.set(JSON.stringify({
                    // 		shouldShow,
                    // 		isShown,
                    // 		reason,
                    // 	}, null, '  '))
                    // 	.prependTo(document.body)
                    //#endregion
                    ////////////////////////////////////
                    if (isShown === shouldShow)
                        return;
                    if (hostHoveredOrFocusedForLongEnough.value && !isShown)
                        Mouse_3.default.onMove(updatePopoverState);
                    if (!shouldShow)
                        Mouse_3.default.offMove(updatePopoverState);
                    if (!shouldShow)
                        FocusTrap.hide();
                    isShown = shouldShow;
                    popover.toggle(shouldShow);
                    if (!shouldShow)
                        return;
                    popover.anchor.from(component);
                    popover.style.setProperty('visibility', 'hidden');
                    FocusTrap.show();
                    // component.popover.style.removeProperties('left', 'top')
                    await Task_1.default.yield();
                    popover.anchor.apply();
                    await Task_1.default.yield();
                    popover.anchor.markDirty();
                    popover.style.removeProperties('visibility');
                }
                function shouldClearPopover() {
                    if (!component.popover)
                        return false;
                    const hovered = HoverListener_1.default.hovered() ?? null;
                    if (component.element.contains(hovered) || component.popover.element.contains(hovered))
                        return false;
                    const clearsPopover = hovered?.closest('[data-clear-popover]');
                    if (!clearsPopover)
                        return false;
                    const clearsPopoverContainsHost = clearsPopover.contains(component.element);
                    if (clearsPopoverContainsHost)
                        return false;
                    const clearsPopoverWithinPopover = clearsPopover.component?.closest(Popover);
                    if (component.popover.containsPopoverDescendant(clearsPopoverWithinPopover))
                        return false;
                    return true;
                }
            },
        }));
    });
    var PopoverStyleTargets;
    (function (PopoverStyleTargets) {
        PopoverStyleTargets[PopoverStyleTargets["Popover"] = 0] = "Popover";
        PopoverStyleTargets[PopoverStyleTargets["PopoverCloseSurface"] = 1] = "PopoverCloseSurface";
        PopoverStyleTargets[PopoverStyleTargets["Popover_AnchoredTop"] = 2] = "Popover_AnchoredTop";
        PopoverStyleTargets[PopoverStyleTargets["Popover_AnchoredLeft"] = 3] = "Popover_AnchoredLeft";
    })(PopoverStyleTargets || (PopoverStyleTargets = {}));
    const Popover = Object.assign((0, Component_5.default)((component) => {
        let mousePadding;
        let delay = 0;
        let unbind;
        const visible = (0, State_13.default)(false);
        let shouldCloseOnInput = true;
        let inputFilter;
        // let normalStacking = false
        const popover = component
            .style.setProperties({
            position: 'fixed',
            margin: 0,
            overflow: 'visible',
            transitionBehavior: 'allow-discrete',
        })
            .tabIndex('programmatic')
            .attributes.set('popover', 'manual')
            .extend(popover => ({
            lastStateChangeTime: 0,
            visible,
            popoverChildren: (0, State_13.default)([]),
            popoverParent: (0, State_13.default)(undefined),
            popoverHasFocus: FocusListener_2.default.focused.map(popover, focused => !focused ? 'no-focus'
                : (visible.value && containsPopoverDescendant(focused)) ? 'focused'
                    : undefined),
            setCloseOnInput(closeOnInput = true) {
                shouldCloseOnInput = closeOnInput;
                return popover;
            },
            setCloseDueToMouseInputFilter(filter) {
                inputFilter = filter;
                return popover;
            },
            setMousePadding: padding => {
                mousePadding = padding;
                return popover;
            },
            setDelay(ms) {
                delay = ms;
                return popover;
            },
            getDelay() {
                return delay;
            },
            // setNormalStacking () {
            // 	Viewport.tablet.use(popover, isTablet => {
            // 		const tablet = isTablet()
            // 		popover.style.toggle(!tablet, 'popover--normal-stacking')
            // 		popover.attributes.toggle(tablet, 'popover', 'manual')
            // 		normalStacking = !tablet
            // 		togglePopover(visible.value)
            // 	})
            // 	return popover
            // },
            isMouseWithin: (checkDescendants = false) => {
                const padding = mousePadding ?? 100;
                const x = popover.rect.value.x - padding;
                const y = popover.rect.value.y - padding;
                const width = popover.rect.value.width + padding * 2;
                const height = popover.rect.value.height + padding * 2;
                const mouseX = Mouse_3.default.state.value.x;
                const mouseY = Mouse_3.default.state.value.y;
                const intersects = (mouseX >= x && mouseX <= x + width) && (mouseY >= y && mouseY <= y + height);
                if (intersects)
                    return true;
                if (checkDescendants)
                    for (const child of popover.popoverChildren.value)
                        if (child.isMouseWithin(true))
                            return true;
                return false;
            },
            containsPopoverDescendant,
            show: () => {
                unbind?.();
                togglePopover(true);
                popover.visible.asMutable?.setValue(true);
                return popover;
            },
            hide: () => {
                unbind?.();
                togglePopover(false);
                popover.visible.asMutable?.setValue(false);
                return popover;
            },
            toggle: shown => {
                unbind?.();
                togglePopover(shown);
                popover.visible.asMutable?.setValue(shown ?? !popover.visible.value);
                return popover;
            },
            bind: state => {
                unbind?.();
                unbind = state.use(popover, shown => {
                    togglePopover(shown);
                    popover.visible.asMutable?.setValue(shown);
                });
                return popover;
            },
            unbind: () => {
                unbind?.();
                return popover;
            },
        }))
            .addStyleTargets(PopoverStyleTargets);
        const style = popover.styleTargets;
        popover.style(style.Popover);
        popover.event.subscribe('toggle', event => {
            popover.visible.asMutable?.setValue(event.newState === 'open');
        });
        popover.onRooted(() => {
            InputBus_1.default.event.subscribe('Down', onInputDown);
            popover.removed.matchManual(true, () => InputBus_1.default.event.unsubscribe('Down', onInputDown));
        });
        return popover;
        function togglePopover(shown) {
            if (!popover.hasContent())
                shown = false;
            // if (normalStacking && !Viewport.tablet.value)
            // 	popover.style.toggle(!shown, 'popover--normal-stacking--hidden')
            // else
            if (Viewport_3.default.tablet.value || popover.rooted.value)
                popover
                    // .style.remove('popover--normal-stacking--hidden')
                    .attributes.set('popover', 'manual')
                    .element.togglePopover(shown);
            (0, Objects_3.mutable)(popover).lastStateChangeTime = Date.now();
        }
        function onInputDown(_, event) {
            if (!popover.visible.value || !shouldCloseOnInput)
                return;
            if (!event.key.startsWith('Mouse') || popover.containsPopoverDescendant(HoverListener_1.default.hovered()))
                return;
            if (inputFilter && !inputFilter(event))
                return;
            if (popover.rooted.value)
                popover
                    .attributes.set('popover', 'manual')
                    .element.togglePopover(false);
            popover.visible.asMutable?.setValue(false);
            (0, Objects_3.mutable)(popover).lastStateChangeTime = Date.now();
        }
        function containsPopoverDescendant(descendant) {
            if (!descendant)
                return false;
            const node = Component_5.default.is(descendant) ? descendant.element : descendant;
            if (popover.element.contains(node))
                return true;
            for (const child of popover.popoverChildren.value)
                if (child === descendant)
                    return true;
                else if (child.containsPopoverDescendant(descendant))
                    return true;
            return false;
        }
    }), {
        forceCloseAll() {
            for (const popoverHost of Component_5.default.findAll(PopoverHost)) {
                const host = popoverHost;
                host.clickState = false;
                host.popover.hide();
            }
        },
    });
    exports.default = Popover;
});
define("kitsui/ext/ComponentInsertionTransaction", ["require", "exports", "kitsui/utility/State"], function (require, exports, State_14) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    State_14 = __importDefault(State_14);
    function ComponentInsertionTransaction(component, onEnd) {
        let unuseComponentRemove = component?.removed.useManual(removed => removed && onComponentRemove());
        const closed = (0, State_14.default)(false);
        let removed = false;
        const result = {
            isInsertionDestination: true,
            closed,
            get size() {
                return component?.element.children.length ?? 0;
            },
            append(...contents) {
                if (closed.value) {
                    for (let content of contents) {
                        content = content && 'component' in content ? content.component : content;
                        if (content && 'remove' in content)
                            content.remove();
                    }
                    return result;
                }
                component?.append(...contents);
                return result;
            },
            prepend(...contents) {
                if (closed.value) {
                    for (let content of contents) {
                        content = content && 'component' in content ? content.component : content;
                        if (content && 'remove' in content)
                            content.remove();
                    }
                    return result;
                }
                component?.prepend(...contents);
                return result;
            },
            insert(direction, sibling, ...contents) {
                if (closed.value) {
                    for (let content of contents) {
                        content = content && 'component' in content ? content.component : content;
                        if (content && 'remove' in content)
                            content.remove();
                    }
                    return result;
                }
                component?.insert(direction, sibling, ...contents);
                return result;
            },
            abort() {
                if (closed.value)
                    return;
                close();
            },
            close() {
                if (closed.value)
                    return;
                if (!removed)
                    onEnd?.(result);
                close();
            },
        };
        return result;
        function close() {
            closed.value = true;
            unuseComponentRemove?.();
            unuseComponentRemove = undefined;
            component?.removeContents();
            component = undefined;
        }
        function onComponentRemove() {
            unuseComponentRemove?.();
            unuseComponentRemove = undefined;
            removed = true;
            result.close();
        }
    }
    exports.default = ComponentInsertionTransaction;
});
define("kitsui/utility/AbortablePromise", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class AbortablePromise extends Promise {
        #controller;
        /**
         * Note that `signal` is not handled for you.
         * If you need to resolve or reject on abort, you will need to add an abort listener.
         */
        constructor(executor) {
            const controller = new AbortController();
            super((resolve, reject) => executor(resolve, reject, controller.signal));
            this.#controller = controller;
            this.abort = this.abort.bind(this);
        }
        /**
         * Sends an abort signal to the promise handler
         */
        abort() {
            if (this.#controller?.signal.aborted)
                return;
            this.#controller?.abort();
        }
    }
    (function (AbortablePromise) {
        function asyncFunction(asyncFunction) {
            return (...args) => new AbortablePromise((resolve, reject, signal) => void asyncFunction(signal, ...args).then(resolve, reject));
        }
        AbortablePromise.asyncFunction = asyncFunction;
        function throttled(asyncFunction) {
            let abort;
            return (...args) => {
                abort?.();
                const promise = new AbortablePromise((resolve, reject, signal) => void asyncFunction(signal, ...args).then(resolve, reject).finally(() => {
                    if (abort === promise.abort)
                        abort = undefined;
                }));
                abort = () => promise.abort();
                return promise;
            };
        }
        AbortablePromise.throttled = throttled;
    })(AbortablePromise || (AbortablePromise = {}));
    exports.default = AbortablePromise;
});
define("kitsui/component/Slot", ["require", "exports", "kitsui/Component", "kitsui/ext/ComponentInsertionTransaction", "kitsui/utility/AbortablePromise", "kitsui/utility/State"], function (require, exports, Component_6, ComponentInsertionTransaction_1, AbortablePromise_1, State_15) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Component_6 = __importStar(Component_6);
    ComponentInsertionTransaction_1 = __importDefault(ComponentInsertionTransaction_1);
    AbortablePromise_1 = __importDefault(AbortablePromise_1);
    State_15 = __importDefault(State_15);
    Component_6.default.extend(component => {
        component.extend(component => ({
            hasContent() {
                const walker = document.createTreeWalker(component.element, NodeFilter.SHOW_TEXT);
                while (walker.nextNode())
                    if (walker.currentNode.textContent?.trim())
                        return true;
                for (const child of component.getDescendants())
                    if (!child.is(Slot))
                        return true;
                return false;
            },
            appendWhen(state, ...contents) {
                const slot = Slot().appendTo(component).preserveContents();
                let temporaryHolder = (0, Component_6.default)().setOwner(slot).append(...contents);
                slot.if(state, slot => {
                    slot.append(...contents);
                    temporaryHolder?.remove();
                    temporaryHolder = undefined;
                });
                return component;
            },
            prependWhen(state, ...contents) {
                const slot = Slot().prependTo(component).preserveContents();
                let temporaryHolder = (0, Component_6.default)().setOwner(slot).append(...contents);
                slot.if(state, slot => {
                    slot.append(...contents);
                    temporaryHolder?.remove();
                    temporaryHolder = undefined;
                });
                return component;
            },
            insertWhen(state, direction, sibling, ...contents) {
                const slot = Slot().insertTo(component, direction, sibling).preserveContents();
                let temporaryHolder = (0, Component_6.default)().setOwner(slot).append(...contents);
                slot.if(state, slot => {
                    slot.append(...contents);
                    temporaryHolder?.remove();
                    temporaryHolder = undefined;
                });
                return component;
            },
            appendToWhen(state, destination) {
                const slot = Slot().appendTo(destination).preserveContents();
                let temporaryHolder = (0, Component_6.default)().setOwner(slot).append(component);
                slot.if(state, slot => {
                    slot.append(component);
                    temporaryHolder?.remove();
                    temporaryHolder = undefined;
                });
                return component;
            },
            prependToWhen(state, destination) {
                const slot = Slot().prependTo(destination).preserveContents();
                let temporaryHolder = (0, Component_6.default)().setOwner(slot).append(component);
                slot.if(state, slot => {
                    slot.append(component);
                    temporaryHolder?.remove();
                    temporaryHolder = undefined;
                });
                return component;
            },
            insertToWhen(state, destination, direction, sibling) {
                const slot = Slot().insertTo(destination, direction, sibling).preserveContents();
                let temporaryHolder = (0, Component_6.default)().setOwner(slot).append(component);
                slot.if(state, slot => {
                    slot.append(component);
                    temporaryHolder?.remove();
                    temporaryHolder = undefined;
                });
                return component;
            },
        }));
    });
    const Slot = Object.assign(Component_6.default.Builder((slot) => {
        let unuse;
        let cleanup;
        let abort;
        let abortTransaction;
        const elses = (0, State_15.default)({ elseIfs: [] });
        let unuseElses;
        let unuseOwner;
        let preserveContents = false;
        let inserted = false;
        const hidden = (0, State_15.default)(false);
        const useDisplayContents = (0, State_15.default)(true);
        let contentsOwner;
        return slot
            .style.bindProperty('display', State_15.default.MapManual([hidden, useDisplayContents], (hidden, useDisplayContents) => hidden ? 'none' : useDisplayContents ? 'contents' : undefined))
            .extend(slot => ({
            useDisplayContents,
            noDisplayContents() {
                useDisplayContents.value = false;
                return slot;
            },
            preserveContents() {
                if (elses.value.elseIfs.length || elses.value.else)
                    throw new Error('Cannot preserve contents when using elses');
                preserveContents = true;
                return slot;
            },
            use: (state, initialiser) => {
                if (preserveContents)
                    throw new Error('Cannot "use" when preserving contents');
                unuse?.();
                unuse = undefined;
                abort?.();
                abort = undefined;
                abortTransaction?.();
                abortTransaction = undefined;
                unuseOwner?.();
                unuseOwner = undefined;
                unuseElses?.();
                unuseElses = undefined;
                if (slot.removed.value)
                    return slot;
                const wasArrayState = Array.isArray(state);
                const wasObjectState = !wasArrayState && !State_15.default.is(state);
                if (wasArrayState) {
                    const owner = State_15.default.Owner.create();
                    unuseOwner = owner.remove;
                    state = State_15.default.Map(owner, state, (...outputs) => outputs);
                }
                else if (wasObjectState) {
                    const owner = State_15.default.Owner.create();
                    unuseOwner = owner.remove;
                    state = State_15.default.Use(owner, state);
                }
                unuse = state.use(slot, value => {
                    abort?.();
                    abort = undefined;
                    cleanup?.();
                    cleanup = undefined;
                    abortTransaction?.();
                    abortTransaction = undefined;
                    contentsOwner?.remove();
                    contentsOwner = State_15.default.Owner.create();
                    const component = (0, Component_6.default)().setOwner(contentsOwner);
                    const transaction = Object.assign((0, ComponentInsertionTransaction_1.default)(component, () => {
                        slot.removeContents();
                        slot.append(...component.element.children);
                        inserted = true;
                        component.remove();
                    }), {
                        closed: component.removed,
                        removed: contentsOwner.removed,
                    });
                    abortTransaction = transaction.abort;
                    handleSlotInitialiserReturn(transaction, wasArrayState
                        ? initialiser(transaction, ...value)
                        : initialiser(transaction, value));
                });
                return slot;
            },
            if: (state, initialiser) => {
                unuse?.();
                unuse = undefined;
                abort?.();
                abort = undefined;
                abortTransaction?.();
                abortTransaction = undefined;
                unuseOwner?.();
                unuseOwner = undefined;
                unuseElses?.();
                unuseElses = undefined;
                if (slot.removed.value)
                    return slot;
                state.use(slot, value => {
                    abort?.();
                    abort = undefined;
                    cleanup?.();
                    cleanup = undefined;
                    abortTransaction?.();
                    abortTransaction = undefined;
                    unuseOwner?.();
                    unuseOwner = undefined;
                    unuseElses?.();
                    unuseElses = undefined;
                    if (!value) {
                        if (preserveContents) {
                            hidden.value = true;
                            return;
                        }
                        let unuseElsesList;
                        const unuseElsesContainer = elses.useManual(elses => {
                            unuseElsesList = State_15.default.MapManual(elses.elseIfs.map(({ state }) => state), (...elses) => elses.indexOf(true))
                                .useManual(elseToUse => {
                                const initialiser = elseToUse === -1 ? elses.else : elses.elseIfs[elseToUse].initialiser;
                                if (!initialiser) {
                                    slot.removeContents();
                                    return;
                                }
                                handleSlotInitialiser(initialiser);
                            });
                        });
                        unuseElses = () => {
                            unuseElsesList?.();
                            unuseElsesContainer();
                        };
                        return;
                    }
                    hidden.value = false;
                    if (preserveContents && inserted)
                        return;
                    handleSlotInitialiser(initialiser);
                });
                return slot;
            },
            elseIf(state, initialiser) {
                if (preserveContents)
                    throw new Error('Cannot use else when preserving contents');
                if (slot.removed.value)
                    return slot;
                elses.value.elseIfs.push({ state, initialiser });
                elses.emit();
                return slot;
            },
            else(initialiser) {
                if (preserveContents)
                    throw new Error('Cannot use else when preserving contents');
                if (slot.removed.value)
                    return slot;
                elses.value.else = initialiser;
                elses.emit();
                return slot;
            },
        }))
            .tweak(slot => slot.removed.matchManual(true, () => cleanup?.()));
        function handleSlotInitialiser(initialiser) {
            contentsOwner?.remove();
            contentsOwner = State_15.default.Owner.create();
            const component = (0, Component_6.default)().setOwner(contentsOwner);
            const transaction = Object.assign((0, ComponentInsertionTransaction_1.default)(component, () => {
                slot.removeContents();
                slot.append(...component.element.children);
                inserted = true;
                component.remove();
            }), {
                closed: component.removed,
                removed: contentsOwner.removed,
            });
            abortTransaction = transaction.abort;
            handleSlotInitialiserReturn(transaction, initialiser(transaction));
        }
        function handleSlotInitialiserReturn(transaction, result) {
            if (!(result instanceof AbortablePromise_1.default))
                return handleSlotInitialiserReturnNonPromise(transaction, result || undefined);
            abort = result.abort;
            result.then(result => handleSlotInitialiserReturnNonPromise(transaction, result || undefined))
                .catch(err => console.error('Slot initialiser promise rejection:', err));
        }
        function handleSlotInitialiserReturnNonPromise(transaction, result) {
            result ||= undefined;
            if (result === slot)
                result = undefined;
            transaction.close();
            abortTransaction = undefined;
            if (Component_6.default.is(result)) {
                result.appendTo(slot);
                inserted = true;
                cleanup = undefined;
                return;
            }
            if (Component_6.ComponentInsertionDestination.is(result)) {
                cleanup = undefined;
                return;
            }
            cleanup = result;
        }
    }), {
        using: (value, initialiser) => Slot().use(State_15.default.get(value), initialiser),
    });
    exports.default = Slot;
});
define("kitsui/component/Tooltip", ["require", "exports", "kitsui/Component", "kitsui/component/Popover"], function (require, exports, Component_7, Popover_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Component_7 = __importDefault(Component_7);
    Popover_1 = __importDefault(Popover_1);
    var TooltipStyleTargets;
    (function (TooltipStyleTargets) {
        TooltipStyleTargets[TooltipStyleTargets["Tooltip"] = 0] = "Tooltip";
    })(TooltipStyleTargets || (TooltipStyleTargets = {}));
    const Tooltip = (0, Component_7.default)((component) => {
        const tooltip = component.and(Popover_1.default)
            .setDelay(200)
            .setMousePadding(0)
            .addStyleTargets(TooltipStyleTargets);
        return tooltip.style(tooltip.styleTargets.Tooltip)
            .anchor.add('aligned left', 'off bottom')
            .anchor.add('aligned left', 'off top')
            .anchor.add('aligned right', 'off bottom')
            .anchor.add('aligned right', 'off top');
    });
    Component_7.default.extend(component => {
        component.extend((component) => ({
            setTooltip(initialiserOrTooltip) {
                if (Component_7.default.is(initialiserOrTooltip))
                    return component.setPopover('hover/longpress', initialiserOrTooltip);
                const initialiser = initialiserOrTooltip;
                return component.setPopover('hover/longpress', (popover, host) => initialiser(popover.and(Tooltip), host));
            },
        }));
    });
    exports.default = Tooltip;
});
define("kitsui", ["require", "exports", "kitsui/component/Dialog", "kitsui/component/Label", "kitsui/component/Loading", "kitsui/component/Popover", "kitsui/component/Slot", "kitsui/component/Tooltip", "kitsui/Component", "kitsui/utility/State"], function (require, exports, Dialog_2, Label_1, Loading_1, Popover_2, Slot_1, Tooltip_1, Component_8, State_16) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Kit = exports.State = exports.Component = void 0;
    Dialog_2 = __importDefault(Dialog_2);
    Label_1 = __importStar(Label_1);
    Loading_1 = __importDefault(Loading_1);
    Popover_2 = __importDefault(Popover_2);
    Slot_1 = __importDefault(Slot_1);
    Tooltip_1 = __importDefault(Tooltip_1);
    Object.defineProperty(exports, "Component", { enumerable: true, get: function () { return __importDefault(Component_8).default; } });
    Object.defineProperty(exports, "State", { enumerable: true, get: function () { return __importDefault(State_16).default; } });
    var Kit;
    (function (Kit) {
        Kit.Label = Label_1.default;
        Kit.LabelTarget = Label_1.LabelTarget;
        Kit.Slot = Slot_1.default;
        Kit.Loading = Loading_1.default;
        Kit.Dialog = Dialog_2.default;
        Kit.Popover = Popover_2.default;
        Kit.Tooltip = Tooltip_1.default;
    })(Kit || (exports.Kit = Kit = {}));
});
define("kitsui/utility/ActiveListener", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ActiveListener;
    (function (ActiveListener) {
        let lastActive = [];
        function allActive() {
            return lastActive;
        }
        ActiveListener.allActive = allActive;
        function active() {
            return lastActive.at(-1);
        }
        ActiveListener.active = active;
        function* allActiveComponents() {
            for (const element of lastActive) {
                const component = element.component;
                if (component)
                    yield component;
            }
        }
        ActiveListener.allActiveComponents = allActiveComponents;
        function activeComponent() {
            return lastActive.at(-1)?.component;
        }
        ActiveListener.activeComponent = activeComponent;
        function listen() {
            document.addEventListener('mousedown', updateActive);
            document.addEventListener('mouseup', updateActive);
            function updateActive(event) {
                if (event.button !== 0)
                    return; // Only consider left mouse button
                const allActive = event.type === 'mousedown' ? getActive(event) : [];
                const active = allActive[allActive.length - 1];
                if (active === lastActive[lastActive.length - 1])
                    return;
                const newActive = [...allActive];
                for (const element of lastActive)
                    if (element.component && !newActive.includes(element))
                        element.component.activeTime.asMutable?.setValue(undefined);
                for (const element of newActive)
                    if (element.component && !lastActive.includes(element))
                        element.component.activeTime.asMutable?.setValue(Date.now());
                lastActive = newActive;
            }
            function getActive(event) {
                const hovered = [];
                let cursor = event.target;
                while (cursor) {
                    hovered.push(cursor);
                    cursor = cursor.parentElement;
                }
                return hovered;
            }
        }
        ActiveListener.listen = listen;
    })(ActiveListener || (ActiveListener = {}));
    exports.default = ActiveListener;
    Object.assign(window, { ActiveListener });
});
define("kitsui/utility/Applicator", ["require", "exports", "kitsui/utility/State"], function (require, exports, State_17) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    State_17 = __importDefault(State_17);
    function Applicator(host, defaultValueOrApply, apply) {
        const defaultValue = !apply ? undefined : defaultValueOrApply;
        apply ??= defaultValueOrApply;
        let unbind;
        const result = makeApplicator(host);
        return result;
        function makeApplicator(host) {
            return {
                state: (0, State_17.default)(defaultValue),
                set: value => {
                    unbind?.();
                    setInternal(value);
                    return host;
                },
                bind: state => {
                    unbind?.();
                    unbind = state?.use(host, setInternal);
                    if (!state)
                        setInternal(defaultValue);
                    return host;
                },
                unbind: () => {
                    unbind?.();
                    setInternal(defaultValue);
                    return host;
                },
                rehost: makeApplicator,
            };
        }
        function setInternal(value) {
            if (result.state.value !== value) {
                result.state.value = value;
                apply(value);
            }
        }
    }
    exports.default = Applicator;
});
define("kitsui/utility/BrowserListener", ["require", "exports", "kitsui/utility/State"], function (require, exports, State_18) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    State_18 = __importDefault(State_18);
    var BrowserListener;
    (function (BrowserListener) {
        BrowserListener.isWebkit = (0, State_18.default)(/AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent));
    })(BrowserListener || (BrowserListener = {}));
    exports.default = BrowserListener;
});
define("kitsui/utility/FontsListener", ["require", "exports", "kitsui/utility/State"], function (require, exports, State_19) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    State_19 = __importDefault(State_19);
    var FontsListener;
    (function (FontsListener) {
        FontsListener.loaded = (0, State_19.default)(false);
        async function listen() {
            await document.fonts.ready;
            FontsListener.loaded.asMutable?.setValue(true);
        }
        FontsListener.listen = listen;
    })(FontsListener || (FontsListener = {}));
    exports.default = FontsListener;
});
define("kitsui/utility/PageListener", ["require", "exports", "kitsui/utility/State"], function (require, exports, State_20) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    State_20 = __importDefault(State_20);
    var PageListener;
    (function (PageListener) {
        PageListener.visible = (0, State_20.default)(document.visibilityState === 'visible');
        document.addEventListener('visibilitychange', () => PageListener.visible.asMutable?.setValue(document.visibilityState === 'visible'));
    })(PageListener || (PageListener = {}));
    exports.default = PageListener;
});
define("kitsui/utility/Style", ["require", "exports", "kitsui/utility/State", "kitsui/utility/Task"], function (require, exports, State_21, Task_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    State_21 = __importDefault(State_21);
    Task_2 = __importDefault(Task_2);
    var Style;
    (function (Style) {
        Style.properties = State_21.default.JIT(() => window.getComputedStyle(document.documentElement));
        const measured = {};
        function measure(property) {
            if (measured[property])
                return measured[property];
            return Style.properties.mapManual(properties => {
                const value = properties.getPropertyValue(property);
                const element = document.createElement('div');
                element.style.width = value;
                element.style.pointerEvents = 'none';
                element.style.opacity = '0';
                element.style.position = 'fixed';
                document.body.appendChild(element);
                const state = measured[property] = (0, State_21.default)(0);
                void Task_2.default.yield().then(() => {
                    state.value = element.clientWidth;
                    element.remove();
                });
                return measured[property];
            });
        }
        Style.measure = measure;
    })(Style || (Style = {}));
    exports.default = Style;
});
define("kitsui/utility/TypeManipulator", ["require", "exports", "kitsui/utility/State"], function (require, exports, State_22) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    State_22 = __importDefault(State_22);
    const TypeManipulator // Object.assign(
     = function (host, onAdd, onRemove) {
        const state = (0, State_22.default)(new Set());
        return Object.assign(add, {
            state,
            remove,
            toggle(has, ...types) {
                if (has)
                    return add(...types);
                else
                    return remove(...types);
            },
        });
        function add(...types) {
            const typesSize = state.value.size;
            const newTypes = types.filter(type => !state.value.has(type));
            for (const type of newTypes)
                state.value.add(type);
            onAdd(newTypes);
            if (state.value.size !== typesSize)
                state.emit();
            return host;
        }
        function remove(...types) {
            const typesSize = state.value.size;
            const oldTypes = types.filter(type => state.value.has(type));
            for (const type of oldTypes)
                state.value.delete(type);
            onRemove(oldTypes);
            if (state.value.size !== typesSize)
                state.emit();
            return host;
        }
    };
    // {
    // 	Style: TypeManipulatorStyle,
    // }
    // )
    // function TypeManipulatorStyle<HOST extends Component, TYPE extends string> (host: HOST, toComponentName: (type: TYPE) => ComponentName): TypeManipulator<HOST, TYPE>
    // function TypeManipulatorStyle<HOST extends Component, TYPE extends string> (host: HOST, applyTo: [StateOr<ArrayOr<Component>>, (type: TYPE) => ComponentName][]): TypeManipulator<HOST, TYPE>
    // function TypeManipulatorStyle<HOST extends Component, TYPE extends string> (host: HOST, applyToIn: [StateOr<ArrayOr<Component>>, (type: TYPE) => ComponentName][] | ((type: TYPE) => ComponentName)) {
    // 	const applyTo = Array.isArray(applyToIn) ? applyToIn : [[host, applyToIn] as const]
    // 	const currentTypes: TYPE[] = []
    // 	let unown: UnsubscribeState | undefined
    // 	return TypeManipulator<HOST, TYPE>(host,
    // 		types => {
    // 			currentTypes.push(...types)
    // 			Arrays.distinctInPlace(currentTypes)
    // 			unown?.()
    // 			const owner = State.Owner.create()
    // 			unown = owner.remove
    // 			for (const [components, toComponentName] of applyTo) {
    // 				if (State.is(components)) {
    // 					components.use(owner, components => {
    // 						for (const component of Arrays.resolve(components))
    // 							for (const type of currentTypes)
    // 								component.style(toComponentName(type))
    // 					})
    // 					continue
    // 				}
    // 				for (const type of types)
    // 					for (const component of Arrays.resolve(components))
    // 						component.style(toComponentName(type))
    // 			}
    // 		},
    // 		types => {
    // 			Arrays.filterInPlace(currentTypes, type => !types.includes(type))
    // 			for (const type of types)
    // 				for (let [components, toComponentName] of applyTo) {
    // 					if (State.is(components))
    // 						components = components.value
    // 					for (const component of Arrays.resolve(components))
    // 						component.style.remove(toComponentName(type))
    // 				}
    // 		},
    // 	)
    // }
    exports.default = TypeManipulator;
});
