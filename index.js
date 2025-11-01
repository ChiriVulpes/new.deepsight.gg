"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
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
(() => {
    const baseURL = self.document?.currentScript?.dataset.baseUrl;
    /**
     * @enum {number}
     */
    const ModuleState = {
        Unprocessed: 0,
        Waiting: 1,
        Processed: 2,
        Error: 3,
    };
    /**
     * @typedef {(module: string) => any} ModuleGetter
     */
    /**
     * @typedef {(modules: string[], resolve: (module: any) => void, reject: (err?: any) => any) => void} ModuleGetterAsync
     */
    /**
     * @typedef {(getModule: ModuleGetter | ModuleGetterAsync, module: Module, ...args: any[]) => any} ModuleInitializer
     */
    /**
     * @typedef {Object} Module
     * @property {true} __esModule - Indicates that this module is an ES module.
     * @property {string} _name - The name of the module.
     * @property {ModuleState} _state - The current state of the module.
     * @property {string[]} _requirements - An array of module names that this module depends on.
     * @property {ModuleInitializer} _initializer - The function that initializes the module.
     * @property {Error} [_error] - An error that occurred during module initialization, if any.
     * @property {boolean} _init - Whether the module should be initialized immediately.
     * @property {true} [_allowRedefine] - Whether the module can be redefined.
     * @property {(module: Module) => void} _replace - A function to replace the module
     * @property {(nameOrNames: string | string[], resolve?: (module: any) => void, reject?: (err?: any) => void) => void | Module} [require] - A function to require other modules.
     * @property {any} [default] - The default export of the module.
     */
    /**
     * @type {Map<string, Module>}
     */
    const moduleMap = new Map();
    /**
     * @type {Set<string>}
     */
    const requirements = new Set();
    /** @type {string | undefined} */
    let nextName;
    /**
     * @param {string | string[]} name
     * @param {string[] | ModuleInitializer} reqs
     * @param {ModuleInitializer?} fn
     */
    function define(name, reqs, fn) {
        if (typeof name === 'function' && !nextName)
            throw new Error('Cannot define module without a name');
        if (typeof name === 'function')
            fn = name, name = /** @type {string} */ (nextName), nextName = undefined;
        if (Array.isArray(name)) {
            fn = /** @type {ModuleInitializer} */ (reqs);
            reqs = name;
            if (nextName) {
                name = nextName;
                nextName = undefined;
            }
            else {
                const src = self.document?.currentScript?.getAttribute('src') || self.document?.currentScript?.getAttribute('data-src');
                if (!src)
                    throw new Error('Cannot define module without a name');
                name = src.startsWith('./') ? src.slice(2)
                    : src.startsWith('/') ? src.slice(1)
                        : src.startsWith(`${location.origin}/`) ? src.slice(location.origin.length + 1)
                            : src;
                const qIndex = name.indexOf('?');
                name = qIndex === -1 ? name : name.slice(0, qIndex);
                name = baseURL && name.startsWith(baseURL) ? name.slice(baseURL.length) : name;
                name = name.endsWith('.js') ? name.slice(0, -3) : name;
                name = name.endsWith('/index') ? name.slice(0, -6) : name;
            }
        }
        reqs ??= [];
        const existingDefinition = moduleMap.get(name);
        if (existingDefinition && !existingDefinition._allowRedefine)
            throw new Error(`Module "${name}" cannot be redefined`);
        if (typeof reqs === 'function') {
            if (fn)
                throw new Error('Unsupport define call');
            fn = reqs;
            reqs = [];
        }
        if (reqs.length < 2 || reqs[0] !== 'require' || reqs[1] !== 'exports') {
            if (reqs.length === 1 && reqs[0] === 'exports') {
                reqs = ['require', 'exports'];
                const oldfn = fn;
                fn = (req, exp) => oldfn(exp);
            }
        }
        const _requirements = reqs.slice(2).map(req => findModuleName(name, req));
        const initialiser = /** @type {ModuleInitializer} */ (fn);
        /**
         * @type {Module}
         */
        const module = {
            __esModule: true,
            _name: name,
            _state: ModuleState.Unprocessed,
            _requirements,
            _initializer: initialiser,
            _init: self.document?.currentScript?.dataset.init === name,
            _replace(newModule) {
                if (typeof newModule !== 'object' && typeof newModule !== 'function')
                    throw new Error('Cannot assign module.exports to a non-object');
                newModule._name = name;
                newModule._state = ModuleState.Unprocessed;
                newModule._requirements = _requirements;
                newModule._initializer = initialiser;
                newModule._replace = module._replace;
                moduleMap.set(name, newModule);
            },
        };
        moduleMap.set(name, module);
        for (const req of module._requirements)
            requirements.add(req);
        const preload = name.endsWith('$preload');
        if (preload) {
            if (module._requirements.length)
                throw new Error(`Module "${name}" cannot import other modules`);
            initializeModule(module);
        }
        if (initialProcessCompleted)
            processModules();
    }
    define.amd = true;
    define.nameNext = function (name) {
        nextName = name;
    };
    /**
     * @param {string} name
     */
    function allowRedefine(name) {
        const module = moduleMap.get(name);
        if (!module)
            return;
        module._allowRedefine = true;
    }
    /**
     * @param {string} name
     * @param {string[]} [requiredBy]
     */
    function getModule(name, requiredBy) {
        requiredBy ??= [];
        let module = moduleMap.get(name);
        if (!module) {
            if (name.endsWith('.js'))
                name = name.slice(0, -3);
            if (name.startsWith('.')) {
                let from = requiredBy[requiredBy.length - 1];
                if (!from.includes('/'))
                    from += '/';
                name = findModuleName(from, name);
            }
            module = moduleMap.get(name);
            if (!module)
                throw new Error(`Module "${name}" has not been declared and cannot be required`);
        }
        if (module._state === ModuleState.Unprocessed)
            module = processModule(name, module, requiredBy);
        return module;
    }
    /**
     * @param {string} name
     */
    function initializeModuleByName(name) {
        const module = getModule(name);
        if (!module)
            throw new Error(`Module "${name}" has not been declared and cannot be initialized`);
        initializeModule(module);
    }
    /**
     * @param {Module} module
     * @param {string[]} [requiredBy]
     * @param {...any} args
     */
    function initializeModule(module, requiredBy, ...args) {
        if (module._state)
            throw new Error(`Module "${module._name}" has already been processed`);
        requiredBy ??= [];
        try {
            requiredBy = [...requiredBy, module._name];
            /**
             * @param {string | string[]} nameOrNames
             * @param {(module: any) => void} [resolve]
             * @param {(err?: any) => void} [reject]
             */
            function require(nameOrNames, resolve, reject) {
                if (Array.isArray(nameOrNames)) {
                    const results = nameOrNames.map(name => getModule(name, requiredBy));
                    return resolve?.(results.length === 1 ? results[0] : results);
                }
                return getModule(nameOrNames, requiredBy);
            }
            module.require = require;
            const result = module._initializer(require, module, ...args);
            if (module.default === undefined) {
                module.default = result ?? module;
                module.__esModule = true;
            }
            const mapCopy = moduleMap.get(module._name);
            if (!mapCopy)
                throw new Error(`Module "${module._name}" has not been defined or has been removed during initialization`);
            module = mapCopy;
            module._state = ModuleState.Processed;
            injectModule(module);
        }
        catch (err) {
            module._state = ModuleState.Error;
            module._error = err;
            err.message = `[Module initialization ${module._name}] ${err.message}`;
            console.error(err);
        }
    }
    const isInjectableModuleDefaultNameRegex = /^[A-Z_$][a-zA-Z_$0-9]+$/;
    function injectModule(module) {
        const name = module._name;
        const inject = module.default ?? module;
        const moduleDefaultName = basename(name);
        if (isInjectableModuleDefaultNameRegex.test(moduleDefaultName) && !(moduleDefaultName in self))
            Object.assign(self, { [moduleDefaultName]: inject });
        for (const key of Object.keys(module)) {
            if (key !== 'default' && !key.startsWith('_') && isInjectableModuleDefaultNameRegex.test(key) && !(key in self)) {
                Object.assign(self, { [key]: module[key] });
            }
        }
    }
    ////////////////////////////////////
    // Add the above functions to "self"
    //
    /**
     * @typedef {Object} SelfExtensions
     * @property {typeof define} define
     * @property {typeof getModule} getModule
     * @property {typeof initializeModuleByName} initializeModule
     * @property {(name: string) => boolean} hasModule
     * @property {typeof allowRedefine} allowRedefine
     */
    const extensibleSelf = /** @type {Window & typeof globalThis & SelfExtensions} */ (self);
    extensibleSelf.define = define;
    extensibleSelf.getModule = getModule;
    extensibleSelf.initializeModule = initializeModuleByName;
    extensibleSelf.allowRedefine = allowRedefine;
    extensibleSelf.hasModule = name => moduleMap.has(name);
    ////////////////////////////////////
    // Actually process the modules
    //
    self.document?.addEventListener('DOMContentLoaded', processModules);
    let initialProcessCompleted = false;
    async function processModules() {
        const scriptsStillToImport = Array.from(self.document?.querySelectorAll('template[data-script]') ?? [])
            .map(definition => {
            const script = /** @type {HTMLTemplateElement} */ (definition).dataset.script;
            definition.remove();
            return script;
        });
        await Promise.all(Array.from(new Set(scriptsStillToImport))
            .filter(v => v !== undefined)
            .map(tryImportAdditionalModule));
        while (requirements.size) {
            const remainingRequirements = Array.from(requirements);
            await Promise.all(remainingRequirements.map(tryImportAdditionalModule));
            for (const req of remainingRequirements)
                requirements.delete(req);
        }
        for (const [name, module] of moduleMap.entries())
            if (module._init)
                processModule(name, module);
        initialProcessCompleted = true;
    }
    /**
     * @param {string} req
     */
    async function tryImportAdditionalModule(req) {
        if (moduleMap.has(req))
            return;
        await importAdditionalModule(req);
        if (!moduleMap.has(req))
            throw new Error(`The required module '${req}' could not be asynchronously loaded.`);
    }
    /**
     * @param {string} req
     */
    async function importAdditionalModule(req) {
        if (self.document) {
            const script = document.createElement('script');
            document.head.appendChild(script);
            /** @type {Promise<void>} */
            const promise = new Promise(resolve => script.addEventListener('load', () => resolve()));
            script.src = `/script/${req}.js`;
            return promise;
        }
        else {
            self.importScripts(`/script/${req}.js`);
        }
    }
    /**
     * @param {string} name
     * @param {Module | undefined} module
     * @param {string[]} requiredBy
     */
    function processModule(name, module = moduleMap.get(name), requiredBy = []) {
        if (!module)
            throw new Error(`No "${name}" module defined`);
        if (module._state === ModuleState.Waiting)
            throw new Error(`Circular dependency! Dependency chain: ${[...requiredBy, name].map(m => `"${m}"`).join(' > ')}`);
        if (!module._state) {
            module._state = ModuleState.Waiting;
            const args = module._requirements
                .map(req => processModule(req, undefined, [...requiredBy, name]));
            module._state = ModuleState.Unprocessed;
            initializeModule(module, requiredBy, ...args);
        }
        return moduleMap.get(name);
    }
    ////////////////////////////////////
    // Utils
    //
    /**
     * @param {string} name
     * @param {string} requirement
     */
    function findModuleName(name, requirement) {
        let root = dirname(name);
        if (requirement.startsWith('./'))
            return join(root, requirement.slice(2));
        while (requirement.startsWith('../'))
            root = dirname(root), requirement = requirement.slice(3);
        return requirement; // join(root, requirement);
    }
    /**
     * @param {string} name
     */
    function dirname(name) {
        const lastIndex = name.lastIndexOf('/');
        return lastIndex === -1 ? '' : name.slice(0, lastIndex);
    }
    /**
     * @param {string} name
     */
    function basename(name) {
        const lastIndex = name.lastIndexOf('/');
        return name.slice(lastIndex + 1);
    }
    /**
     * @param  {...string} path
     */
    function join(...path) {
        return path.filter(p => p).join('/');
    }
})();
define("utility/Env", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Env {
        async init() {
            const raw = await fetch('/.env').then(res => res.text());
            const acc = this;
            for (const line of raw.split('\n')) {
                if (line.startsWith('#') || !line.trim())
                    continue;
                let [key, value] = line.split('=');
                if (!key || !value)
                    throw new Error(`Invalid .env line: ${line}`);
                key = key.trim();
                value = value.trim();
                if (value.startsWith('"') && value.endsWith('"'))
                    value = value.slice(1, -1);
                acc[key] = value;
            }
        }
    }
    exports.default = new Env();
});
define("Relic", ["require", "exports", "conduit.deepsight.gg", "kitsui", "utility/Env"], function (require, exports, conduit_deepsight_gg_1, kitsui_1, Env_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    conduit_deepsight_gg_1 = __importDefault(conduit_deepsight_gg_1);
    Env_1 = __importDefault(Env_1);
    let resolveConduit;
    const connected = new Promise(resolve => resolveConduit = resolve);
    exports.default = Object.assign((0, kitsui_1.State)(undefined), {
        connected,
        async init() {
            const conduit = await (0, conduit_deepsight_gg_1.default)({
                service: Env_1.default.CONDUIT_ORIGIN,
            });
            this.asMutable?.setValue(conduit);
            Object.assign(window, { conduit });
            resolveConduit(conduit);
        },
    });
});
define("utility/ViewTransition", ["require", "exports", "kitsui", "kitsui/utility/Arrays"], function (require, exports, kitsui_2, Arrays_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // view transition api fallback
    const noopViewTransition = {
        types: new Set(),
        finished: Promise.resolve(undefined),
        ready: Promise.resolve(undefined),
        updateCallbackDone: Promise.resolve(undefined),
        skipTransition: () => { },
    };
    document.startViewTransition ??= cb => {
        cb?.();
        return noopViewTransition;
    };
    function stripName(name) {
        return name?.replace(/[^a-z0-9-]+/g, '-').toLowerCase();
    }
    var ViewTransition;
    (function (ViewTransition) {
        const DATA_VIEW_TRANSITION_NAME = 'data-view-transition-name';
        const DATA_VIEW_TRANSITION_CLASS = 'data-view-transition-class';
        const DATA_SUBVIEW_TRANSITION_NAME = 'data-subview-transition-name';
        const DATA_ID = 'data-view-transition-id';
        const VIEW_TRANSITION_CLASS_VIEW = 'view-transition';
        const VIEW_TRANSITION_CLASS_VIEW_SWIPE = 'view-transition-swipe';
        const VIEW_TRANSITION_CLASS_SUBVIEW = 'subview-transition';
        const VIEW_TRANSITION_CLASS_DELAY = 'view-transition-delay';
        const PADDING = 100;
        kitsui_2.Component.extend(component => component.extend(component => ({
            viewTransition(name) {
                if (name) {
                    name = name.replace(/[^a-z0-9-]+/g, '-').toLowerCase();
                    component.attributes.set(DATA_VIEW_TRANSITION_NAME, name);
                    component.attributes.set(DATA_VIEW_TRANSITION_CLASS, VIEW_TRANSITION_CLASS_VIEW);
                    component.attributes.compute(DATA_ID, () => `${id++}`);
                }
                else {
                    component.attributes.remove(DATA_VIEW_TRANSITION_NAME);
                    component.attributes.remove(DATA_VIEW_TRANSITION_CLASS);
                    component.attributes.remove(DATA_ID);
                }
                return component;
            },
            viewTransitionSwipe(name) {
                if (name) {
                    name = name.replace(/[^a-z0-9-]+/g, '-').toLowerCase();
                    component.attributes.set(DATA_VIEW_TRANSITION_NAME, name);
                    component.attributes.set(DATA_VIEW_TRANSITION_CLASS, VIEW_TRANSITION_CLASS_VIEW_SWIPE);
                    component.attributes.compute(DATA_ID, () => `${id++}`);
                }
                else {
                    component.attributes.remove(DATA_VIEW_TRANSITION_NAME);
                    component.attributes.remove(DATA_VIEW_TRANSITION_CLASS);
                    component.attributes.remove(DATA_ID);
                }
                return component;
            },
            subviewTransition(name) {
                if (name) {
                    name = stripName(name);
                    component.attributes.set(DATA_SUBVIEW_TRANSITION_NAME, name);
                    component.attributes.compute(DATA_ID, () => `${id++}`);
                }
                else {
                    component.attributes.remove(DATA_SUBVIEW_TRANSITION_NAME);
                    component.attributes.remove(DATA_ID);
                }
                return component;
            },
        })));
        let id = 0;
        let i = 0;
        let queuedUnapply;
        function perform(type, name, swap) {
            queuedUnapply = undefined;
            if (typeof name === 'function') {
                swap = name;
                name = undefined;
            }
            name = stripName(name);
            reapply(type, name);
            async function doSwap() {
                await swap();
                reapply(type, name);
            }
            const transition = document.startViewTransition(doSwap);
            const id = queuedUnapply = i++;
            transition.finished
                .catch(async (err) => {
                if (!String(err).includes('AbortError')) {
                    console.error('Error during view transition:', err);
                    return;
                }
                await doSwap();
            })
                .finally(() => {
                if (queuedUnapply !== id)
                    // another view transition started, no unapply
                    return;
                unapply(type);
            });
            return {
                finished: transition.finished.catch(() => { }),
                ready: transition.ready.catch(() => { }),
                updateCallbackDone: transition.updateCallbackDone.catch(() => { }),
                skipTransition: () => transition.skipTransition(),
            };
        }
        ViewTransition.perform = perform;
        function reapply(type, name) {
            const components = getComponents(type, name).filter(isInView);
            let i = 0;
            if (type === 'view')
                for (const component of components) {
                    const cls = component.attributes.get(DATA_VIEW_TRANSITION_CLASS).value;
                    component.classes.add(cls ?? VIEW_TRANSITION_CLASS_VIEW);
                    const name = component.attributes.get(DATA_VIEW_TRANSITION_NAME).value;
                    component.style.setVariable('view-transition-delay', `${VIEW_TRANSITION_CLASS_DELAY}-${i}`);
                    component.style.setProperty('view-transition-name', `${VIEW_TRANSITION_CLASS_VIEW}-${name}-${i++}`);
                }
            else
                for (const component of components) {
                    component.classes.add(VIEW_TRANSITION_CLASS_SUBVIEW);
                    const name = component.attributes.get(DATA_SUBVIEW_TRANSITION_NAME).value;
                    const id = +component.attributes.get(DATA_ID).value || 0;
                    component.style.setProperty('view-transition-name', `${VIEW_TRANSITION_CLASS_SUBVIEW}-${name}-${id}`);
                    component.style.setVariable('view-transition-delay', `${VIEW_TRANSITION_CLASS_DELAY}-${i++}`);
                }
        }
        ViewTransition.reapply = reapply;
        function unapply(type) {
            for (const component of [...getComponents('view'), ...getComponents('subview')]) {
                component.classes.remove(VIEW_TRANSITION_CLASS_VIEW, VIEW_TRANSITION_CLASS_VIEW_SWIPE);
                component.classes.remove(VIEW_TRANSITION_CLASS_SUBVIEW);
                component.style.removeProperties('view-transition-name');
                component.style.removeVariables('view-transition-delay');
            }
        }
        ViewTransition.unapply = unapply;
        function isInView(component) {
            const rect = component.element.getBoundingClientRect();
            return true
                && rect.bottom > -PADDING && rect.top < window.innerHeight + PADDING
                && rect.right > -PADDING && rect.left < window.innerWidth + PADDING;
        }
        function getComponents(type, name) {
            return [...document.querySelectorAll(`[${type === 'view' ? DATA_VIEW_TRANSITION_NAME : DATA_SUBVIEW_TRANSITION_NAME}${name ? `="${name}"` : ''}]`)]
                .map(e => e.component)
                .filter(Arrays_1.NonNullish);
        }
    })(ViewTransition || (ViewTransition = {}));
    exports.default = ViewTransition;
});
define("component/Kit", ["require", "exports", "kitsui", "utility/ViewTransition"], function (require, exports, kitsui_3, ViewTransition_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = styleKit;
    ViewTransition_1 = __importDefault(ViewTransition_1);
    function styleKit() {
        ////////////////////////////////////
        //#region Loading
        kitsui_3.Kit.Loading.extend(loading => {
            let normalTransitions = false;
            const spinner = loading.spinner;
            loading.spinner.append(...[1, 2, 3, 4].map(i => (0, kitsui_3.Component)().style('loading-spinner-dot', `loading-spinner-dot-${i}`)));
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            const interval = setInterval(async () => {
                for (const dot of spinner.getChildren())
                    dot.style('loading-spinner-dot--no-animate');
                await new Promise(resolve => setTimeout(resolve, 10));
                for (const dot of spinner.getChildren())
                    dot.style.remove('loading-spinner-dot--no-animate');
            }, 2000);
            loading.onSet((loading, owner, state) => {
                loading.errorText.text.bind(state.error.map(owner, error => error?.message ?? (quilt => quilt['shared/errored']())));
            });
            let trans;
            loading.onLoad((loading, display) => {
                if (normalTransitions)
                    return display();
                const transInstance = trans = ViewTransition_1.default.perform('view', display);
                Object.assign(loading, { transitionFinished: trans.finished });
                void trans.finished.then(() => {
                    if (trans === transInstance)
                        trans = undefined;
                    if (loading.transitionFinished === transInstance.finished)
                        Object.assign(loading, { transitionFinished: undefined });
                });
            });
            loading.onRemoveManual(() => clearInterval(interval));
            return {
                skipViewTransition() {
                    trans?.skipTransition();
                },
                setNormalTransitions() {
                    normalTransitions = true;
                    return this;
                },
            };
        });
        kitsui_3.Kit.Loading.styleTargets({
            Loading: 'loading',
            LoadingLoaded: 'loading--loaded',
            Spinner: 'loading-spinner',
            ProgressBar: 'loading-progress',
            ProgressBarProgressUnknown: 'loading-progress--unknown',
            MessageText: 'loading-message',
            ErrorIcon: 'loading-error-icon',
            ErrorText: 'loading-error',
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Popover
        kitsui_3.Kit.Popover.styleTargets({
            Popover: 'popover',
            PopoverCloseSurface: 'popover-close-surface',
            Popover_AnchoredTop: 'popover--anchored-top',
            Popover_AnchoredLeft: 'popover--anchored-left',
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Dialog
        kitsui_3.Kit.Dialog.styleTargets({
            Dialog: 'dialog',
            Dialog_Open: 'dialog--open',
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Tooltip
        kitsui_3.Kit.Tooltip.extend(tooltip => {
            const main = (0, kitsui_3.Component)()
                .style('tooltip-block')
                .style.bind(tooltip.visible, 'tooltip-block--visible')
                .appendTo(tooltip);
            const content = (0, kitsui_3.Component)()
                .style('tooltip-content')
                .appendTo(main);
            const header = (0, kitsui_3.Component)()
                .style('tooltip-header')
                .appendTo(content);
            const body = (0, kitsui_3.Component)()
                .style('tooltip-body')
                .appendTo(content);
            tooltip.extendJIT('extra', () => (0, kitsui_3.Component)()
                .style('tooltip-content', 'tooltip-extra')
                .appendTo((0, kitsui_3.Component)()
                .style('tooltip-block')
                .style.bind(tooltip.visible, 'tooltip-block--visible')
                .appendTo(tooltip.style('tooltip--has-extra'))));
            return {
                content,
                header,
                body,
            };
        });
        kitsui_3.Kit.Tooltip.styleTargetsPartial({
            Tooltip: 'tooltip',
        });
        //#endregion
        ////////////////////////////////////
    }
});
define("utility/Store", ["require", "exports", "kitsui"], function (require, exports, kitsui_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // export type IStoreEvents =
    // 	& { [KEY in keyof ILocalStorage as `set${Capitalize<KEY>}`]: { value: ILocalStorage[KEY]; oldValue: ILocalStorage[KEY] } }
    // 	& { [KEY in keyof ILocalStorage as `delete${Capitalize<KEY>}`]: { oldValue: ILocalStorage[KEY] } }
    let storage;
    let statesProxy;
    let states;
    class Store {
        // public static readonly event = EventManager.make<IStoreEvents>()
        static get items() {
            return storage ??= new Proxy({}, {
                has(_, key) {
                    return Store.has(key);
                },
                get(_, key) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                    return Store.get(key);
                },
                set(_, key, value) {
                    return Store.set(key, value);
                },
                deleteProperty(_, key) {
                    return Store.delete(key);
                },
            });
        }
        static get state() {
            const s = states ??= {};
            return statesProxy ??= new Proxy({}, {
                has(_, key) {
                    return Store.has(key);
                },
                get(_, key) {
                    return s[key] ??= (0, kitsui_4.State)(Store.get(key));
                },
            });
        }
        static get full() {
            const result = {};
            for (const [key, value] of Object.entries(localStorage))
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment
                result[key] = JSON.parse(value);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return result;
        }
        static has(key) {
            return localStorage.getItem(key) !== null;
        }
        static get(key) {
            const value = localStorage.getItem(key);
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return value === null ? null : JSON.parse(value);
            }
            catch {
                localStorage.removeItem(key);
                return null;
            }
        }
        static set(key, value) {
            // const oldValue = Store.get(key)
            if (value === undefined)
                localStorage.removeItem(key);
            else
                localStorage.setItem(key, JSON.stringify(value));
            // Store.event.emit(`set${key[0].toUpperCase()}${key.slice(1)}` as keyof IStoreEvents, { value, oldValue } as never)
            const state = states?.[key];
            if (state)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                state.value = value;
            return true;
        }
        static delete(key) {
            // const oldValue = Store.get(key)
            localStorage.removeItem(key);
            // Store.event.emit(`delete${key[0].toUpperCase()}${key.slice(1)}` as keyof IStoreEvents, { oldValue } as never)
            const state = states?.[key];
            if (state)
                state.value = undefined;
            return true;
        }
    }
    exports.default = Store;
    Object.assign(window, { Store });
});
define("model/Profile", ["require", "exports", "kitsui", "Relic", "utility/Store"], function (require, exports, kitsui_5, Relic_1, Store_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Relic_1 = __importDefault(Relic_1);
    Store_1 = __importDefault(Store_1);
    var Profile;
    (function (Profile) {
        Profile.STATE = (0, kitsui_5.State)({ selected: undefined, all: [] });
        let inited;
        async function init() {
            if (inited)
                return inited;
            return inited = refresh();
        }
        Profile.init = init;
        async function refresh() {
            const conduit = await Relic_1.default.connected;
            conduit.on.profilesUpdated(updateProfiles);
            updateProfiles(await conduit.getProfiles());
        }
        Profile.refresh = refresh;
        function updateProfiles(profiles) {
            if (!Store_1.default.items.selectedProfile)
                // select the first authed profile by default
                Store_1.default.items.selectedProfile = profiles.find(profile => profile.authed)?.id;
            const selected = profiles.find(profile => profile.id === Store_1.default.items.selectedProfile);
            Profile.STATE.value = {
                selected,
                all: profiles,
            };
        }
    })(Profile || (Profile = {}));
    exports.default = Profile;
});
define("component/core/Button", ["require", "exports", "kitsui"], function (require, exports, kitsui_6) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Button = (0, kitsui_6.Component)('button', (component) => {
        const button = component.style('button');
        const buttonText = (0, kitsui_6.Component)().style('button-text').appendTo(button);
        button.extendJIT('text', button => buttonText.text.rehost(button));
        const disabledReasons = (0, kitsui_6.State)(new Set());
        const disabled = disabledReasons.mapManual(reasons => !!reasons.size);
        const unsubscribeStates = new Map();
        const unsubscribeReasons = new Map();
        return button
            .style.bind(disabled, 'button--disabled')
            .style.bind(button.hoveredOrHasFocused, 'button--hover')
            .attributes.bind(disabled, 'disabled')
            .attributes.bind(disabled, 'aria-disabled', 'true')
            .extend(button => ({
            disabled,
            textWrapper: buttonText,
            setDisabled(disabled, reason) {
                unsubscribeReasons.get(reason)?.();
                unsubscribeReasons.delete(reason);
                if (disabled)
                    disabledReasons.value.add(reason);
                else
                    disabledReasons.value.delete(reason);
                disabledReasons.emit();
                return button;
            },
            bindDisabled(state, reason) {
                unsubscribeReasons.get(reason)?.();
                unsubscribeReasons.delete(reason);
                const unsubscribe = state.use(button, value => {
                    if (value)
                        disabledReasons.value.add(reason);
                    else
                        disabledReasons.value.delete(reason);
                    disabledReasons.emit();
                });
                const map = unsubscribeStates.get(state) ?? new Map();
                unsubscribeStates.set(state, map);
                map.set(unsubscribe, reason);
                return button;
            },
            unbindDisabled(state) {
                const map = unsubscribeStates.get(state);
                if (map)
                    for (const [unsubscribe, reason] of map) {
                        unsubscribe();
                        unsubscribeReasons.delete(reason);
                    }
                unsubscribeStates.delete(state);
                return button;
            },
        }));
    });
    exports.default = Button;
});
define("component/core/DisplaySlot", ["require", "exports", "kitsui", "kitsui/component/Slot"], function (require, exports, kitsui_7, Slot_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Slot_1 = __importDefault(Slot_1);
    exports.default = (0, kitsui_7.Component)((component) => {
        return component.and(Slot_1.default).noDisplayContents();
    });
});
define("utility/Text", ["require", "exports", "kitsui", "kitsui/utility/StringApplicator", "lang"], function (require, exports, kitsui_8, StringApplicator_1, lang_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.quilt = void 0;
    lang_1 = __importStar(lang_1);
    exports.quilt = (0, kitsui_8.State)(lang_1.default);
    var Text;
    (function (Text) {
        function init() {
            StringApplicator_1.StringApplicatorSource.register('weave', {
                match(source) {
                    return typeof source === 'function';
                },
                toNodes(source) {
                    return renderWeave(source(exports.quilt.value));
                },
                toString(source) {
                    return source(exports.quilt.value).toString();
                },
            });
        }
        Text.init = init;
        function isWeave(weave) {
            return Object.keys(weave).includes('toString');
        }
        Text.isWeave = isWeave;
        function renderWeave(weave) {
            return weave.content.map(renderWeft);
        }
        Text.renderWeave = renderWeave;
        function renderWeft(weft) {
            if (isPlaintextWeft(weft))
                return document.createTextNode(weft.content);
            const tag = weft.tag?.toLowerCase();
            let element = !tag ? undefined : createTagElement(tag);
            element ??= document.createElement('span');
            if (Array.isArray(weft.content))
                element.append(...weft.content.map(renderWeft));
            else if (typeof weft.content === 'object' && weft.content) {
                if (!lang_1.WeavingArg.isRenderable(weft.content)) {
                    if (isWeave(weft.content))
                        element.append(...renderWeave(weft.content));
                    else
                        element.append(renderWeft(weft.content));
                }
                else if (kitsui_8.Component.is(weft.content))
                    element.append(weft.content.element);
                else if (weft.content instanceof Node)
                    element.append(weft.content);
                else
                    console.warn('Unrenderable weave content:', weft.content);
            }
            else {
                const value = `${weft.content ?? ''}`;
                const texts = value.split('\n');
                for (let i = 0; i < texts.length; i++) {
                    if (i > 0)
                        element.append((0, kitsui_8.Component)('br').element, (0, kitsui_8.Component)().style('break').element);
                    element.append(document.createTextNode(texts[i]));
                }
            }
            return element;
        }
        function isPlaintextWeft(weft) {
            return true
                && typeof weft.content === 'string'
                && !weft.content.includes('\n')
                && !weft.tag;
        }
        function createTagElement(tag) {
            tag = tag.toLowerCase();
            if (tag.startsWith('link(')) {
                let href = tag.slice(5, -1);
                // const link = href.startsWith('/')
                // 	? Link(href as RoutePath)
                // 	: ExternalLink(href)
                if (!href.startsWith('/') && !href.startsWith('.'))
                    href = `https://${href}`;
                return (0, kitsui_8.Component)('a')
                    .attributes.set('href', href)
                    .element;
            }
            // if (tag.startsWith('.')) {
            // 	const className = tag.slice(1)
            // 	if (className in style.value)
            // 		return Component()
            // 			.style(className as keyof typeof style.value)
            // 			.element
            // }
            // if (tag.startsWith('icon.')) {
            // 	const className = `button-icon-${tag.slice(5)}`
            // 	if (className in style.value)
            // 		return Component()
            // 			.style('button-icon', className as keyof typeof style.value, 'button-icon--inline')
            // 			.element
            // }
            switch (tag) {
                case 'b': return document.createElement('strong');
                case 'i': return document.createElement('em');
                case 'u': return document.createElement('u');
                case 's': return document.createElement('s');
                case 'code': return (0, kitsui_8.Component)('code').style('code').element;
                // case 'sm': return Component('small')
                // 	.style('small')
                // 	.element
            }
        }
        Text.createTagElement = createTagElement;
    })(Text || (Text = {}));
    exports.default = Text;
});
define("component/display/Filter", ["require", "exports", "component/core/Button", "component/core/DisplaySlot", "kitsui", "kitsui/component/Popover", "kitsui/component/Slot", "kitsui/utility/Arrays", "kitsui/utility/InputBus", "kitsui/utility/Mouse", "kitsui/utility/Task", "utility/Text"], function (require, exports, Button_1, DisplaySlot_1, kitsui_9, Popover_1, Slot_2, Arrays_2, InputBus_1, Mouse_1, Task_1, Text_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_1 = __importDefault(Button_1);
    DisplaySlot_1 = __importDefault(DisplaySlot_1);
    Popover_1 = __importDefault(Popover_1);
    Slot_2 = __importDefault(Slot_2);
    InputBus_1 = __importDefault(InputBus_1);
    Mouse_1 = __importDefault(Mouse_1);
    Task_1 = __importDefault(Task_1);
    var FilterToken;
    (function (FilterToken) {
        function create(text, start = 0, end = text.length) {
            return Object.assign(String(text), {
                lowercase: (text
                    .toLowerCase()
                    .replace(EMOJI_REGEX, '')),
                displayText: (text
                    .replaceAll(' ', '\xa0')
                    .replace(EMOJI_REGEX, '')),
                start,
                end,
            });
        }
        FilterToken.create = create;
    })(FilterToken || (FilterToken = {}));
    const PLAINTEXT_FILTER_FUNCTION = (item, token) => item.displayProperties.name.toLowerCase().includes(token.lowercase);
    const PLAINTEXT_FILTER_TWEAK_CHIP = (chip, token) => chip.style('filter-display-text').style.toggle(token.lowercase.length < 3, 'filter-display-text--inactive');
    const EMOJI_ICON_PLACEHOLDER = '⬛';
    const EMOJI_REGEX = /(?!\p{N})[\p{Emoji}\p{Extended_Pictographic}]/gu;
    const EMOJI_SPACE_PLACEHOLDER = '–';
    const EMOJI_OR_WHITESPACE_REGEX = /[– ]+/gu;
    ////////////////////////////////////
    //#region Filter Display Chip
    const Chip = (0, kitsui_9.Component)((component, match) => {
        const iconWrapper = match.icon && (0, kitsui_9.Component)()
            .style('filter-display-chip-icon-wrapper');
        const iconPlaceholder = iconWrapper && (0, kitsui_9.Component)()
            .style('filter-display-chip-icon-placeholder')
            .text.set(EMOJI_ICON_PLACEHOLDER)
            .appendTo(iconWrapper);
        const icon = iconWrapper && (0, kitsui_9.Component)()
            .style('filter-display-chip-icon', `filter-display-chip-icon--${match.id}`)
            .tweak(icon => typeof match.icon === 'function' && match.icon(icon, match.token))
            .appendTo(iconWrapper);
        const textWrapper = (0, kitsui_9.Component)()
            .style('filter-display-chip-text-wrapper');
        (0, kitsui_9.Component)()
            .style('filter-display-chip-text-placeholder')
            .text.set(match.token.displayText)
            .appendTo(textWrapper);
        const labelText = (0, kitsui_9.Component)()
            .style('filter-display-chip-text-label')
            .appendTo(textWrapper);
        const filterText = (0, kitsui_9.Component)()
            .style('filter-display-chip-text-main')
            .text.set(match.token.displayText)
            .appendTo(textWrapper);
        return component
            .style('filter-display-chip', `filter-display-chip--${match.id}`)
            .append(iconWrapper, textWrapper)
            .extend(chip => ({
            iconWrapper,
            iconPlaceholder,
            icon,
            textWrapper: textWrapper,
            labelWrapper: labelText,
            labelText: labelText.text.rehost(chip),
            mainTextWrapper: filterText,
        }))
            .extendJIT('text', chip => filterText.text.rehost(chip))
            .tweak(chip => match.chip?.(chip, match.token));
    });
    //#endregion
    ////////////////////////////////////
    const Filter = Object.assign((0, kitsui_9.Component)((component) => {
        const filter = component.style('filter');
        const config = (0, kitsui_9.State)(undefined);
        let filtersOwner;
        const filterText = (0, kitsui_9.State)('');
        const caretPosition = (0, kitsui_9.State)(0);
        ////////////////////////////////////
        //#region Filter Parsing
        const filters = kitsui_9.State.Map(filter, [filterText, config], (text, config) => {
            filtersOwner?.remove();
            filtersOwner = kitsui_9.State.Owner.create();
            text = config?.allowUppercase ? text : text.toLowerCase();
            const tokens = tokenise(text);
            if (tokens.length === 0)
                return [];
            const filters = [];
            NextToken: for (const token of tokens) {
                for (const filter of config?.filters ?? []) {
                    const fn = filter.match(filtersOwner, token);
                    if (!fn)
                        continue;
                    filters.push(Object.assign(fn, { token, id: filter.id }));
                    continue NextToken;
                }
                filters.push({
                    id: 'plaintext',
                    fullText: config?.allowUppercase ? token.slice() : token.lowercase,
                    isPartial: true,
                    token,
                    filter: PLAINTEXT_FILTER_FUNCTION,
                    chip: PLAINTEXT_FILTER_TWEAK_CHIP,
                });
            }
            return filters;
        });
        let filterFullTextsOwner;
        const filterFullTexts = filters.mapManual(filters => {
            filterFullTextsOwner?.remove();
            filterFullTextsOwner = kitsui_9.State.Owner.create();
            return kitsui_9.State.Map(filterFullTextsOwner, filters.map(filter => kitsui_9.State.get(filter.fullText)), (...texts) => texts);
        });
        const appliedFilters = filters.mapManual(filters => filters.filter(filter => filter.id !== 'plaintext' || filter.token.lowercase.length >= 3));
        const appliedFilterText = appliedFilters.mapManual(filters => filters.map(filter => `"${config.value?.allowUppercase ? filter.token.slice() : filter.token.lowercase}"`).join(' '));
        let noPartialFiltersOwner;
        const noPartialFilters = filters.mapManual(filters => {
            noPartialFiltersOwner?.remove();
            noPartialFiltersOwner = kitsui_9.State.Owner.create();
            return kitsui_9.State.Map(noPartialFiltersOwner, filters.map(filter => kitsui_9.State.get(filter.isPartial)), (...partialStates) => !partialStates.includes(true));
        });
        const debounceFinished = (0, kitsui_9.State)(true);
        let filterTextEditTimeout;
        appliedFilterText.useManual(filterText => {
            debounceFinished.value = false;
            clearTimeout(filterTextEditTimeout);
            filterTextEditTimeout = window.setTimeout(() => {
                debounceFinished.value = true;
            }, config.value?.debounceTime ?? 200);
        });
        let oldFilterText = '';
        const debouncedFilterText = kitsui_9.State.MapManual([appliedFilterText, noPartialFilters, debounceFinished], (filterText, noPartialFilters, debounceFinished) => {
            return oldFilterText = noPartialFilters || debounceFinished ? filterText : oldFilterText;
        });
        function tokenise(filterText) {
            const tokens = [];
            let doubleQuote = false;
            let tokenStart = 0;
            let tokenEnd = 0;
            for (let i = 0; i < filterText.length + 1; i++) {
                if (i === filterText.length)
                    doubleQuote = false; // end of string, reset double quote state
                const char = filterText[i] ?? ' ';
                if (char === '"')
                    doubleQuote = !doubleQuote;
                const isSpace = !doubleQuote && (false
                    || char === ' '
                    || filterText.slice(i, i + EMOJI_SPACE_PLACEHOLDER.length) === EMOJI_SPACE_PLACEHOLDER);
                if (isSpace) {
                    const spaceLength = char === ' ' ? 1 : EMOJI_SPACE_PLACEHOLDER.length;
                    if (tokenEnd === tokenStart) { // skip consecutive spaces
                        tokenStart += spaceLength;
                        tokenEnd += spaceLength;
                        continue;
                    }
                    const tokenText = filterText.slice(tokenStart, tokenEnd);
                    tokens.push(FilterToken.create(tokenText, tokenStart, tokenEnd));
                    tokenStart = tokenEnd = i + spaceLength; // put new start after space
                    continue;
                }
                tokenEnd++; // extend current token by 1 char
            }
            return tokens;
        }
        const selectedToken = kitsui_9.State.MapManual([filters, caretPosition], (filters, caretPosition) => {
            if (caretPosition === undefined)
                return undefined;
            for (const filter of filters)
                if (caretPosition >= filter.token.start && caretPosition <= filter.token.end)
                    return filter.token;
            return undefined;
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Input
        const input = (0, kitsui_9.Component)('input')
            .attributes.set('type', 'text')
            .attributes.bind('placeholder', Text_1.quilt.map(filter, quilt => quilt['display-bar/filter/placeholder']().toString()))
            .style('filter-input')
            .style.bind(component.hasFocused, 'filter-input--has-focus')
            .style.bind(filterText.truthy, 'filter-input--has-content')
            .event.subscribe('input', e => filterText.value = e.host.element.value)
            .event.subscribe('selectionchange', e => caretPosition.value = e.host.element.selectionStart === e.host.element.selectionEnd ? e.host.element.selectionStart ?? undefined : undefined)
            .appendTo(filter);
        function spliceInput(start, end, replacement, collapseLeft) {
            const inputElement = input.element;
            const originalValue = inputElement.value;
            let caretStart = inputElement.selectionStart;
            let caretEnd = inputElement.selectionEnd;
            const selectionDirection = inputElement.selectionDirection;
            inputElement.value = originalValue.slice(0, start) + replacement + originalValue.slice(end);
            const delta = replacement.length - (end - start);
            const shiftRightPos = collapseLeft ? end + 1 : end;
            caretStart = caretStart === null ? null : caretStart >= shiftRightPos ? caretStart + delta : Math.min(start, caretStart);
            caretEnd = caretEnd === null ? null : caretEnd >= shiftRightPos ? caretEnd + delta : Math.min(start, caretEnd);
            inputElement.setSelectionRange(caretStart, caretEnd, selectionDirection ?? undefined);
        }
        ////////////////////////////////////
        //#region Hidden Emoji Spacing
        filters.use(input, filters => {
            for (let i = filters.length - 1; i >= 0; i--) {
                const filter = filters[i];
                const lastStart = filters[i + 1]?.token.start ?? input.element.value.length;
                const textAfter = input.element.value.slice(filter.token.end, lastStart);
                for (const match of textAfter.matchAll(EMOJI_OR_WHITESPACE_REGEX).toArray().reverse()) {
                    // ensure all whitespace between tokens is single ➕ characters
                    const start = filter.token.end + (match.index ?? 0);
                    const end = start + match[0].length;
                    spliceInput(start, end, EMOJI_SPACE_PLACEHOLDER);
                }
                for (const match of filter.token.matchAll(EMOJI_REGEX).toArray().reverse()) {
                    // remove emojis from the token
                    const start = filter.token.start + (match.index ?? 0);
                    const end = start + match[0].length;
                    spliceInput(start, end, '');
                }
                if (filter.icon) {
                    // insert a ⬛ emoji at the start of tokens with icon
                    const start = filter.token.start;
                    spliceInput(start, start, EMOJI_ICON_PLACEHOLDER, true);
                }
            }
            // ensure the state is up to date with the emojis
            // (this won't infinitely recurse because the emojis will have already been corrected the first time)
            filterText.value = input.element.value;
        });
        //#endregion
        ////////////////////////////////////
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Filter Display
        (0, kitsui_9.Component)()
            .style('filter-display')
            .tweak(wrapper => {
            const displayData = filters.map(wrapper, filters => {
                const display = [];
                for (let i = 0; i < filters.length; i++) {
                    const filter = filters[i];
                    const lastEnd = filters[i - 1]?.token.end ?? 0;
                    const spaceLength = filter.token.start - lastEnd;
                    if (spaceLength)
                        display.push({
                            type: 'space',
                            length: spaceLength,
                        });
                    display.push({
                        type: 'chip',
                        id: filter.id,
                        match: filter,
                    });
                }
                return display;
            });
            displayData.use(wrapper, (newDisplayData, oldDisplayData = []) => {
                let n = 0;
                let o = 0;
                let lastComponent;
                NextNew: for (; n < newDisplayData.length; n++) {
                    const newDisplayDataItem = newDisplayData[n];
                    for (; o < oldDisplayData.length; o++) {
                        const oldDisplayDataItem = oldDisplayData[o];
                        const matches = newDisplayDataItem.type === 'chip' && oldDisplayDataItem.type === 'chip'
                            ? (newDisplayDataItem.id === oldDisplayDataItem.id
                                && newDisplayDataItem.match.token.slice() === oldDisplayDataItem.match.token.slice())
                            : newDisplayDataItem.type === 'space' && oldDisplayDataItem.type === 'space'
                                ? newDisplayDataItem.length === oldDisplayDataItem.length
                                : false;
                        if (!matches) {
                            oldDisplayDataItem.component?.remove();
                            continue;
                        }
                        o++;
                        lastComponent = oldDisplayDataItem.component;
                        newDisplayDataItem.component = oldDisplayDataItem.component;
                        continue NextNew;
                    }
                    // this token didn't exist before, so create a new component for it
                    switch (newDisplayDataItem.type) {
                        case 'space':
                            lastComponent = newDisplayDataItem.component = (0, kitsui_9.Component)()
                                .style('filter-display-space')
                                .text.set(EMOJI_SPACE_PLACEHOLDER.repeat(newDisplayDataItem.length))
                                .insertTo(wrapper, 'after', lastComponent);
                            break;
                        case 'chip': {
                            lastComponent = newDisplayDataItem.component = Chip(newDisplayDataItem.match)
                                .insertTo(wrapper, 'after', lastComponent);
                            break;
                        }
                    }
                }
                // remove other components that have been removed
                const children = wrapper.getChildren().toArray();
                for (const child of children)
                    if (!newDisplayData.some(item => item.component === child))
                        child.remove();
            });
        })
            .appendTo(filter);
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Suggested Filters
        const popover = (0, Popover_1.default)()
            .style('filter-popover')
            .anchor.from(input)
            .anchor.add('aligned left', 'off top')
            .setCloseDueToMouseInputFilter(event => !filter.contains(event.targetComponent))
            .event.subscribe('click', e => e.host.focus())
            .appendTo(document.body);
        const mouseWithinPopover = kitsui_9.State.Map(popover, [Mouse_1.default.state, popover.visible], (mouse, visible) => visible && popover.isMouseWithin());
        kitsui_9.State.Some(popover, input.hasFocused, popover.hasFocused, mouseWithinPopover).subscribe(popover, async (focused) => {
            if (!focused) {
                if (InputBus_1.default.isDown('F4'))
                    return;
                popover.hide();
                return;
            }
            popover.style.setProperty('width', `${input.element.offsetWidth}px`);
            popover.style.setProperty('visibility', 'hidden');
            popover.show();
            popover.focus();
            popover.style.removeProperties('left', 'top');
            await Task_1.default.yield();
            popover.anchor.apply();
            await Task_1.default.yield();
            popover.style.removeProperties('visibility');
        });
        (0, kitsui_9.Component)()
            .style('filter-popover-title')
            .text.set(quilt => quilt['display-bar/filter/suggestions/title']())
            .appendTo(popover);
        (0, DisplaySlot_1.default)()
            .style('filter-popover-suggestions-wrapper')
            .use(config, (slot, config) => {
            for (const filter of config?.filters ?? []) {
                const suggestions = kitsui_9.State.get(typeof filter.suggestions === 'function' ? filter.suggestions(slot) : filter.suggestions);
                (0, Slot_2.default)().appendTo(slot).use(suggestions, (slot, suggestions) => {
                    const suggestionMatches = (Array.isArray(suggestions) ? suggestions : suggestions.all)
                        .map((suggestion) => {
                        const token = FilterToken.create(suggestion);
                        const match = filter.match(slot, token);
                        if (!match)
                            return undefined;
                        return Object.assign(match, { token, id: filter.id });
                    })
                        .filter(Arrays_2.NonNullish);
                    for (const suggestion of suggestionMatches)
                        (0, Button_1.default)()
                            .tweak(button => button.textWrapper.remove())
                            .and(Chip, suggestion)
                            .style.remove('filter-display-chip')
                            .style('filter-popover-suggestion')
                            .tweak(chip => chip.textWrapper.style('filter-popover-suggestion-text-wrapper'))
                            .append((0, kitsui_9.Component)().style('filter-popover-suggestion-colour-wrapper'))
                            .event.subscribe('click', async (e) => {
                            spliceInput(selectedToken.value?.start ?? caretPosition.value ?? 0, selectedToken.value?.end ?? caretPosition.value ?? 0, `${suggestion.token.lowercase} `);
                            filterText.value = input.element.value;
                            const selectionStart = input.element.selectionStart;
                            const selectionEnd = input.element.selectionEnd;
                            const selectionDirection = input.element.selectionDirection;
                            await Task_1.default.yield();
                            input.focus();
                            input.element.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? undefined);
                        })
                            .appendToWhen(kitsui_9.State.Map(slot, [selectedToken, filterFullTexts], (selectedToken, filters) => {
                            const lowercase = suggestion.token.lowercase;
                            return true
                                // this suggestion isn't already something we're filtering by
                                && !filters.includes(lowercase)
                                // ensure the suggestion matches the current filter text
                                && (!selectedToken || lowercase.startsWith(selectedToken.lowercase))
                                // ensure the suggestion matches the filter provided
                                && (Array.isArray(suggestions) ? true : suggestions.filter?.(lowercase, selectedToken, filters) ?? true);
                        }), slot);
                });
            }
        })
            .appendTo(popover);
        //#endregion
        ////////////////////////////////////
        return filter.extend(filter => ({
            input,
            filterText: debouncedFilterText,
            config,
            filter: (item, showIrrelevant) => {
                const parsedFilters = appliedFilters.value;
                if (!parsedFilters.length)
                    return true;
                const groupedFilters = Object.groupBy(parsedFilters, filter => filter.id);
                for (const [filterId, filters] of Object.entries(groupedFilters)) {
                    if (!filters)
                        continue;
                    const type = config.value?.filters.find(filter => filter.id === filterId)?.type ?? 'and';
                    switch (type) {
                        case 'and':
                            for (const filter of filters) {
                                const result = filter.filter(item, filter.token);
                                if (!result || (!showIrrelevant && result === 'irrelevant'))
                                    return false;
                            }
                            break;
                        case 'or': {
                            let hasMatch = false;
                            for (const filter of filters) {
                                const result = filter.filter(item, filter.token);
                                if (result === true || (result === 'irrelevant' && showIrrelevant)) {
                                    hasMatch = true;
                                    break;
                                }
                            }
                            if (!hasMatch)
                                return false;
                        }
                    }
                }
                return true;
            },
        }));
    }), {
        Definition(definition) {
            return definition;
        },
    });
    exports.default = Filter;
});
define("component/core/Image", ["require", "exports", "kitsui", "kitsui/utility/Task"], function (require, exports, kitsui_10, Task_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Task_2 = __importDefault(Task_2);
    exports.default = (0, kitsui_10.Component)('img', (component, src, fallback) => {
        src = kitsui_10.State.get(src);
        return component.replaceElement('img')
            .style('image')
            .tweak(image => {
            let abort;
            src.use(image, async (src) => {
                abort?.abort();
                if (component.attributes.has('src')) {
                    abort = new AbortController();
                    const signal = abort.signal;
                    component.attributes.remove('src');
                    component.style.remove('image--loaded');
                    await Task_2.default.yield();
                    if (signal.aborted)
                        return;
                }
                component.attributes.set('src', src);
            });
        })
            .event.subscribe('load', () => {
            component.style('image--loaded');
        })
            .event.subscribe('error', () => {
            component.attributes.set('src', fallback);
        });
    });
});
define("component/display/filter/FilterAmmo", ["require", "exports", "component/core/Image", "component/display/Filter", "kitsui", "kitsui/utility/Arrays", "Relic"], function (require, exports, Image_1, Filter_1, kitsui_11, Arrays_3, Relic_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Image_1 = __importDefault(Image_1);
    Filter_1 = __importDefault(Filter_1);
    Relic_2 = __importDefault(Relic_2);
    const DestinyAmmoDefinition = kitsui_11.State.Async(kitsui_11.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_2.default.connected;
        const ammoTypes = [
            [1 /* DestinyAmmunitionType.Primary */, 3740194278 /* PresentationNodeHashes.Primary_ObjectiveHashUndefined */],
            [2 /* DestinyAmmunitionType.Special */, 3098463839 /* PresentationNodeHashes.Special_Scope0 */],
            [3 /* DestinyAmmunitionType.Heavy */, 3253265639 /* PresentationNodeHashes.Heavy_ObjectiveHashUndefined */],
        ];
        const nodes = await Promise.all(ammoTypes
            .map(([, nodeHash]) => conduit.definitions.en.DestinyPresentationNodeDefinition.get(nodeHash)));
        return nodes.map(node => node && {
            displayProperties: node?.displayProperties,
            hash: ammoTypes.find(([, nodeHash]) => nodeHash === node.hash)?.[0] ?? 0 /* DestinyAmmunitionType.None */,
        });
    });
    const prefix = 'ammo:';
    exports.default = Filter_1.default.Definition({
        id: 'ammo',
        type: 'or',
        suggestions: DestinyAmmoDefinition.mapManual(defs => {
            return Object.values(defs ?? {})
                .filter(Arrays_3.NonNullish)
                .map(def => def?.displayProperties?.name)
                .filter(name => !!name)
                .map(name => `${prefix}${name.toLowerCase()}`);
        }),
        match(owner, token) {
            if (!token.lowercase.startsWith(prefix))
                return undefined;
            const element = token.lowercase.slice(prefix.length).trim();
            const ammoType = DestinyAmmoDefinition.map(owner, defs => {
                const matches = Object.values(defs ?? {})
                    .filter(def => def?.displayProperties?.name.toLowerCase().startsWith(element));
                return matches.length === 1 ? matches[0] : undefined;
            });
            const [labelText, filterText] = token.displayText.split(':');
            return {
                fullText: ammoType.map(owner, def => !def ? token.lowercase : `${prefix}${def.displayProperties.name.toLowerCase()}`),
                isPartial: ammoType.falsy,
                chip(chip, token) {
                    chip.style('filter-display-chip--ammo');
                    chip.style.bindFrom(ammoType.map(chip, def => def && `filter-display-chip--ammo--${def.displayProperties.name.toLowerCase()}`));
                    chip.labelText.set(`${labelText}:`);
                    chip.text.set(filterText);
                },
                icon(icon, token) {
                    (0, Image_1.default)(ammoType.map(icon, def => def && `https://www.bungie.net${def.displayProperties.icon}`))
                        .appendToWhen(ammoType.truthy, icon);
                },
                filter(item, token) {
                    return !item.ammo ? 'irrelevant'
                        : item.ammo === ammoType.value?.hash;
                },
            };
        },
    });
});
define("component/display/filter/FilterElement", ["require", "exports", "component/core/Image", "component/display/Filter", "kitsui", "Relic"], function (require, exports, Image_2, Filter_2, kitsui_12, Relic_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Image_2 = __importDefault(Image_2);
    Filter_2 = __importDefault(Filter_2);
    Relic_3 = __importDefault(Relic_3);
    const DestinyDamageTypeDefinition = kitsui_12.State.Async(kitsui_12.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_3.default.connected;
        return await conduit.definitions.en.DestinyDamageTypeDefinition.all();
    });
    const prefix = 'element:';
    const defaultOrder = [
        3373582085 /* DamageTypeHashes.Kinetic */,
        3454344768 /* DamageTypeHashes.Void */,
        2303181850 /* DamageTypeHashes.Arc */,
        1847026933 /* DamageTypeHashes.Solar */,
        151347233 /* DamageTypeHashes.Stasis */,
        3949783978 /* DamageTypeHashes.Strand */,
    ];
    exports.default = Filter_2.default.Definition({
        id: 'element',
        type: 'or',
        suggestions: DestinyDamageTypeDefinition.mapManual(defs => {
            return Object.values(defs ?? {})
                .filter(def => def.hash !== 1067729826 /* DamageTypeHashes.Raid */)
                .sort((a, b) => defaultOrder.indexOf(a.hash) - defaultOrder.indexOf(b.hash))
                .map(def => def?.displayProperties?.name)
                .filter(name => !!name)
                .map(name => `${prefix}${name.toLowerCase()}`);
        }),
        match(owner, token) {
            if (!token.lowercase.startsWith(prefix))
                return undefined;
            const element = token.lowercase.slice(prefix.length).trim();
            const damageType = DestinyDamageTypeDefinition.map(owner, defs => {
                const matches = Object.values(defs ?? {})
                    .filter(def => def?.displayProperties?.name.toLowerCase().startsWith(element));
                return matches.length === 1 ? matches[0] : undefined;
            });
            const [labelText, filterText] = token.displayText.split(':');
            return {
                fullText: damageType.map(owner, def => !def ? token.lowercase : `${prefix}${def.displayProperties.name.toLowerCase()}`),
                isPartial: damageType.falsy,
                chip(chip, token) {
                    chip.style('filter-display-chip--element');
                    chip.style.bindFrom(damageType.map(chip, def => def && `filter-display-chip--element--${def.displayProperties.name.toLowerCase()}`));
                    chip.labelText.set(`${labelText}:`);
                    chip.text.set(filterText);
                },
                icon(icon, token) {
                    (0, Image_2.default)(damageType.map(icon, def => def && `https://www.bungie.net${def.displayProperties.icon}`))
                        .appendToWhen(damageType.truthy, icon);
                },
                filter(item, token) {
                    return !item.damageTypes?.length ? 'irrelevant'
                        : item.damageTypes.includes(damageType.value?.hash ?? NaN);
                },
            };
        },
    });
});
define("component/DisplayBar", ["require", "exports", "component/core/Button", "component/display/Filter", "component/display/filter/FilterAmmo", "component/display/filter/FilterElement", "kitsui"], function (require, exports, Button_2, Filter_3, FilterAmmo_1, FilterElement_1, kitsui_13) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_2 = __importDefault(Button_2);
    Filter_3 = __importDefault(Filter_3);
    FilterAmmo_1 = __importDefault(FilterAmmo_1);
    FilterElement_1 = __importDefault(FilterElement_1);
    const DisplayBarButton = (0, kitsui_13.Component)((component) => {
        const button = component.and(Button_2.default)
            .style.remove('button')
            .tweak(button => button.textWrapper.remove())
            .style('display-bar-button')
            .style.bind(component.hoveredOrHasFocused, 'display-bar-button--hover')
            .style.bind(component.active, 'display-bar-button--active');
        (0, kitsui_13.Component)()
            .style('display-bar-button-icon')
            .appendTo(button);
        const title = (0, kitsui_13.Component)()
            .style('display-bar-button-title')
            .appendTo(button);
        const subtitle = (0, kitsui_13.Component)()
            .style('display-bar-button-subtitle')
            .appendTo(button);
        return button.extend(button => ({
            title,
            titleText: title.text.rehost(button),
            subtitle,
            subtitleText: subtitle.text.rehost(button),
        }));
    });
    const DisplayBar = Object.assign((0, kitsui_13.Component)((component) => {
        component.style('display-bar');
        const config = (0, kitsui_13.State)(undefined);
        const noSort = config.mapManual(config => !config?.sortConfig);
        DisplayBarButton()
            .style('display-bar-sort-button')
            .style.bind(noSort, 'display-bar-button--disabled')
            .attributes.bind(noSort, 'inert')
            .titleText.set(quilt => quilt['display-bar/sort/title']())
            .appendTo(component);
        const filter = (0, Filter_3.default)();
        filter.config.bind(filter, config.map(filter, config => ({
            id: 'display-bar-default-filter',
            filters: [FilterElement_1.default, FilterAmmo_1.default],
            ...config?.filterConfig,
        })));
        DisplayBarButton()
            .style('display-bar-filter-button')
            .titleText.set(quilt => quilt['display-bar/filter/title']())
            .tweak(button => {
            button.title
                .style('display-bar-filter-button-title')
                .style.bind(filter.filterText.truthy, 'display-bar-filter-button-title--has-filter')
                .style.bind(button.hasFocused, 'display-bar-filter-button-title--has-focus');
            button.subtitle.append(filter);
        })
            .appendTo(component);
        DisplayBarButton()
            .style('display-bar-help-button')
            .titleText.set(quilt => quilt['display-bar/help/title']())
            .subtitleText.set(quilt => quilt['display-bar/help/subtitle']())
            .appendTo(component);
        return component
            .extend(displayBar => ({
            config,
            handlers: {
                filter,
            },
        }))
            .appendToWhen(config.truthy, kitsui_13.Component.getBody());
    }), {
        Config(config) {
            return config;
        },
    });
    exports.default = DisplayBar;
});
define("component/core/Link", ["require", "exports", "kitsui"], function (require, exports, kitsui_14) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Link = (0, kitsui_14.Component)('a', (component, hrefIn) => {
        const href = (0, kitsui_14.State)('/');
        href.bind(component, kitsui_14.State.get(hrefIn));
        const overrideClick = (0, kitsui_14.State)(true);
        return component
            .replaceElement('a')
            .attributes.bind('href', href)
            .extend(link => ({
            href,
            overrideClick,
            navigate() {
                return navigate.toURL(href.value);
            },
        }))
            .onRooted(link => {
            link.event.subscribe('click', event => {
                if (!link.overrideClick.value)
                    return;
                event.preventDefault();
                void link.navigate();
            });
        });
    });
    exports.default = Link;
});
define("style/icons", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ICONS_CODEPOINTS = exports.Icons = void 0;
    var Icons;
    (function (Icons) {
        Icons["AmmoHeavy"] = "ammo-heavy";
        Icons["AmmoPrimary"] = "ammo-primary";
        Icons["AmmoSpecial"] = "ammo-special";
        Icons["DamageArc"] = "damage-arc";
        Icons["DamageKinetic"] = "damage-kinetic";
        Icons["DamagePrismatic"] = "damage-prismatic";
        Icons["DamageSolar"] = "damage-solar";
        Icons["DamageStasis"] = "damage-stasis";
        Icons["DamageStrand"] = "damage-strand";
        Icons["DamageVoid"] = "damage-void";
        Icons["Power"] = "power";
    })(Icons || (exports.Icons = Icons = {}));
    exports.ICONS_CODEPOINTS = {
        [Icons.AmmoHeavy]: "61697",
        [Icons.AmmoPrimary]: "61698",
        [Icons.AmmoSpecial]: "61699",
        [Icons.DamageArc]: "61700",
        [Icons.DamageKinetic]: "61701",
        [Icons.DamagePrismatic]: "61702",
        [Icons.DamageSolar]: "61703",
        [Icons.DamageStasis]: "61704",
        [Icons.DamageStrand]: "61705",
        [Icons.DamageVoid]: "61706",
        [Icons.Power]: "61707",
    };
});
define("component/core/Icon", ["require", "exports", "kitsui", "style/icons"], function (require, exports, kitsui_15, icons_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Icon = (0, kitsui_15.Component)((component, icon) => {
        return component
            .style('icon', `icon-${icon}`)
            .text.set(String.fromCodePoint(+icons_1.ICONS_CODEPOINTS[icon]));
    });
    exports.default = new Proxy({}, {
        get(target, p) {
            return Icon(icons_1.Icons[p]);
        },
    });
});
define("component/profile/ProfileButton", ["require", "exports", "component/core/Button", "component/core/Icon", "kitsui"], function (require, exports, Button_3, Icon_1, kitsui_16) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_3 = __importDefault(Button_3);
    Icon_1 = __importDefault(Icon_1);
    const ProfileButton = (0, kitsui_16.Component)((component, profile) => {
        const displayMode = (0, kitsui_16.State)('collapsed');
        const button = component.and(Button_3.default)
            .style('profile-button')
            .style.bind(displayMode.equals('expanded'), 'profile-button--expanded')
            .style.bind(displayMode.equals('simple'), 'profile-button--simple')
            .style.bind(displayMode.mapManual(mode => mode !== 'simple' && !!profile.authed), 'profile-button--authed')
            .style.bind(displayMode.equals('expanded').mapManual(expanded => expanded && !!profile.authed), 'profile-button--authed--expanded');
        button.textWrapper.remove();
        if (profile.emblem)
            button
                .style.setVariable('emblem-icon', `url(https://www.bungie.net${profile.emblem.displayProperties.icon})`)
                .style.setVariable('emblem-background', `url(https://www.bungie.net${profile.emblem.secondaryIcon})`)
                .style.setVariable('emblem-background-overlay', `url(https://www.bungie.net${profile.emblem.secondaryOverlay})`)
                .style.setVariable('emblem-background-secondary', `url(https://www.bungie.net${profile.emblem.secondarySpecial})`)
                .style.setVariable('emblem-colour', `#${profile.emblem.background.toString(16).padStart(6, '0')}`);
        const isSimple = displayMode.equals('simple');
        (0, kitsui_16.Component)()
            .style('profile-button-icon')
            .style.bind(isSimple, 'profile-button-icon--overlay')
            .style.bind(kitsui_16.State.Every(button, isSimple, button.hoveredOrHasFocused), 'profile-button-icon--overlay--hover')
            .appendToWhen(displayMode.notEquals('expanded'), button);
        (0, kitsui_16.Component)()
            .style('profile-button-border')
            .style.bind(displayMode.equals('simple'), 'profile-button-border--simple')
            .style.bind(button.hoveredOrHasFocused, 'profile-button-border--hover')
            .appendTo(button);
        (0, kitsui_16.Component)()
            .style('profile-button-name')
            .append((0, kitsui_16.Component)().style('profile-button-name-display').text.set(profile.name))
            .append((0, kitsui_16.Component)().style('profile-button-name-code').text.set(`#${profile.code}`))
            .appendTo(button);
        (0, kitsui_16.Component)()
            .style('profile-button-power')
            .style.toggle(profile.power > 200, 'profile-button-power--seasonal-bonus')
            .append(Icon_1.default.Power)
            .text.append(`${profile.power}${profile.power > 200 ? '+' : ''}`)
            .appendToWhen(displayMode.equals('expanded'), button);
        if (profile.clan?.callsign)
            (0, kitsui_16.Component)()
                .style('profile-button-clan-callsign')
                .text.set(`[${profile.clan.callsign}]`)
                .appendToWhen(displayMode.equals('collapsed'), button);
        if (profile.guardianRank)
            (0, kitsui_16.Component)()
                .style('profile-button-guardian-rank')
                .append((0, kitsui_16.Component)()
                .style('profile-button-guardian-rank-icon')
                .append((0, kitsui_16.Component)().style('profile-button-guardian-rank-icon-number').text.set(profile.guardianRank.rank.toString())))
                .append((0, kitsui_16.Component)().style('profile-button-guardian-rank-name').text.set(profile.guardianRank.name))
                .appendToWhen(displayMode.equals('expanded'), button);
        if (profile.clan?.name)
            (0, kitsui_16.Component)()
                .style('profile-button-clan-name')
                .text.set(profile.clan.name)
                .appendToWhen(displayMode.equals('expanded'), button);
        return button.extend(button => ({
            mode: displayMode,
        }));
    });
    exports.default = ProfileButton;
});
define("component/WordmarkLogo", ["require", "exports", "kitsui", "utility/Env"], function (require, exports, kitsui_17, Env_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Env_2 = __importDefault(Env_2);
    exports.default = (0, kitsui_17.Component)(component => {
        return component.style('wordmark-logo')
            .append((0, kitsui_17.Component)('img')
            .style('wordmark-logo-icon')
            .attributes.set('src', `${Env_2.default.ORIGIN}/static/logo.png`))
            .append((0, kitsui_17.Component)('img')
            .style('wordmark-logo-wordmark')
            .attributes.set('src', `${Env_2.default.ORIGIN}/static/wordmark.png`));
    });
});
define("component/Navbar", ["require", "exports", "component/core/Link", "component/profile/ProfileButton", "component/WordmarkLogo", "kitsui", "kitsui/component/Slot", "model/Profile"], function (require, exports, Link_1, ProfileButton_1, WordmarkLogo_1, kitsui_18, Slot_3, Profile_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Link_1 = __importDefault(Link_1);
    ProfileButton_1 = __importDefault(ProfileButton_1);
    WordmarkLogo_1 = __importDefault(WordmarkLogo_1);
    Slot_3 = __importDefault(Slot_3);
    Profile_1 = __importDefault(Profile_1);
    const Navbar = (0, kitsui_18.Component)('nav', (component) => {
        const visible = (0, kitsui_18.State)(false);
        const viewTransitionsEnabled = (0, kitsui_18.State)(false);
        const homeLinkState = (0, kitsui_18.State)('/');
        const homelink = (0, Link_1.default)(homeLinkState)
            .and(WordmarkLogo_1.default)
            .style('navbar-homelink')
            .appendTo(component);
        (0, Slot_3.default)()
            .appendTo(component)
            .use(Profile_1.default.STATE, (slot, profiles) => profiles.selected
            && (0, ProfileButton_1.default)(profiles.selected)
                .style('navbar-profile-button')
                .tweak(button => button.mode.setValue('simple')));
        viewTransitionsEnabled.use(component, enabled => {
            homelink.viewTransition(enabled && 'wordmark-logo-home-link');
        });
        return component.style('navbar')
            .extend(navbar => ({
            visible,
            viewTransitionsEnabled,
            overrideHomeLink(route, owner) {
                homeLinkState.value = route;
                void owner.removed.await(navbar, true).then(() => {
                    if (homeLinkState.value === route)
                        homeLinkState.value = '/';
                });
                return navbar;
            },
        }))
            .appendToWhen(visible, kitsui_18.Component.getBody());
    });
    exports.default = Navbar;
});
define("component/Overlay", ["require", "exports", "kitsui"], function (require, exports, kitsui_19) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const visibleOverlays = new Set();
    const hasVisible = (0, kitsui_19.State)(false);
    const Overlay = Object.assign((0, kitsui_19.Component)((component, owner) => {
        let unsubscribe;
        return component
            .setOwner(owner)
            .appendTo(document.body)
            .style('overlay')
            .extend(overlay => ({
            bind(state) {
                unsubscribe?.();
                overlay.style.bind(state, 'overlay--visible');
                unsubscribe = state.use(overlay, visible => {
                    if (visible)
                        visibleOverlays.add(overlay);
                    else
                        visibleOverlays.delete(overlay);
                    hasVisible.value = visibleOverlays.size > 0;
                });
                return overlay;
            },
        }))
            .onRemoveManual(overlay => {
            visibleOverlays.delete(overlay);
            hasVisible.value = visibleOverlays.size > 0;
        });
    }), {
        hasVisible,
    });
    exports.default = Overlay;
});
define("component/core/View", ["require", "exports", "component/DisplayBar", "component/Navbar", "component/Overlay", "kitsui", "kitsui/component/Loading", "kitsui/utility/Task", "utility/ViewTransition"], function (require, exports, DisplayBar_1, Navbar_1, Overlay_1, kitsui_20, Loading_1, Task_3, ViewTransition_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    DisplayBar_1 = __importDefault(DisplayBar_1);
    Navbar_1 = __importDefault(Navbar_1);
    Overlay_1 = __importDefault(Overlay_1);
    Loading_1 = __importDefault(Loading_1);
    Task_3 = __importDefault(Task_3);
    ViewTransition_2 = __importDefault(ViewTransition_2);
    const SYMBOL_VIEW_PARAMS = Symbol('VIEW_PARAMS');
    const ViewExt = kitsui_20.Component.Extension(view => view);
    let viewContainer;
    let navbar;
    let displayBar;
    function View(builder) {
        const hasNavbar = (0, kitsui_20.State)(true);
        const displayBarConfig = (0, kitsui_20.State)(undefined);
        return (0, kitsui_20.Component)((component, paramsIn) => {
            const params = (0, kitsui_20.State)(paramsIn);
            const view = component
                .and(ViewExt)
                .style('view')
                .extend(view => ({
                loading: undefined,
                hasNavbar,
                displayBarConfig,
                displayHandlers: displayBarConfig.map(view, config => config ? displayBar?.handlers : undefined),
                refresh: navigate.refresh,
                params,
                getNavbar() {
                    return navbar;
                },
            }));
            let loading;
            let setLoadingApi;
            const loadingApiPromise = new Promise(resolve => setLoadingApi = resolve);
            let markLoadFinished;
            let markFinishResolved;
            const finishResolvedPromise = new Promise(resolve => markFinishResolved = resolve);
            view.extendJIT('loading', () => loading ??= Object.assign((0, Loading_1.default)(), {
                start() {
                    return loadingApiPromise;
                },
                finish() {
                    markLoadFinished?.();
                    markLoadFinished = undefined;
                    setLoadingApi = undefined;
                    return finishResolvedPromise;
                },
            }));
            let builderPromise;
            const trans = ViewTransition_2.default.perform('view', () => {
                for (const view of viewContainer?.getChildren(ViewExt) ?? [])
                    view.remove();
                builderPromise = builder(view);
                viewContainer ??= (0, kitsui_20.Component)()
                    .style('view-container')
                    .tweak(container => {
                    let savedScroll = 0;
                    Overlay_1.default.hasVisible.use(container, async (hasVisible) => {
                        if (hasVisible) {
                            savedScroll = document.documentElement.scrollTop;
                            document.documentElement.scrollTop = 0;
                            container.style('view-container--has-overlay')
                                .style.setVariable('overlay-scroll-margin-top', `${savedScroll}px`);
                            kitsui_20.Component.getDocument().style.removeVariables('overlay-scroll-margin-top');
                            return;
                        }
                        const overlayScrollTop = document.documentElement.scrollTop;
                        kitsui_20.Component.getDocument().style.setVariable('overlay-scroll-margin-top', `${-overlayScrollTop}px`);
                        document.documentElement.scrollTop = 0;
                        container.style.remove('view-container--has-overlay');
                        await Task_3.default.yield();
                        kitsui_20.Component.getDocument().style.setVariable('overlay-scroll-margin-top', `${savedScroll - overlayScrollTop}px`);
                        container.style.removeVariables('overlay-scroll-margin-top');
                        document.documentElement.scrollTop = savedScroll;
                    });
                })
                    .appendTo(document.body);
                view.appendTo(viewContainer);
                navbar ??= (0, Navbar_1.default)();
                displayBar ??= (0, DisplayBar_1.default)();
                const newShowNavbar = view.hasNavbar.value;
                if (navbar.visible.value !== newShowNavbar) {
                    navbar.viewTransitionsEnabled.value = true;
                    navbar.visible.value = newShowNavbar;
                }
                if (!view.displayBarConfig.value && displayBar)
                    displayBar.config.value = undefined;
            });
            void trans.finished.then(() => {
                if (navbar)
                    navbar.viewTransitionsEnabled.value = false;
                if (!loading) {
                    displayBar?.config.bind(view, view.displayBarConfig);
                    return;
                }
                const loadFinishedPromise = new Promise(resolve => markLoadFinished = resolve);
                loading.set(async (signal, setProgress) => {
                    setLoadingApi({
                        signal,
                        setProgress,
                    });
                    await loadFinishedPromise;
                    return {};
                }, async () => {
                    markFinishResolved();
                    await builderPromise;
                    void Promise.resolve(loading?.transitionFinished).then(() => {
                        displayBar?.config.bind(view, view.displayBarConfig);
                    });
                });
            });
            return view;
        });
    }
    exports.default = View;
});
define("utility/Objects", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports._ = void 0;
    exports._ = undefined;
});
define("navigation/Route", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    let lastView;
    function Route(path, viewBuilder) {
        const segments = (path.startsWith('/') ? path.slice(1) : path).split('/');
        const varGroups = [];
        let regexString = '^';
        for (const segment of segments) {
            regexString += '/+';
            if (segment[0] !== '$') {
                regexString += segment;
                continue;
            }
            if (segment[1] === '$') {
                varGroups.push(segment.slice(2));
                regexString += '(.*)';
                continue;
            }
            varGroups.push(segment.slice(1));
            regexString += '([^/]+)';
        }
        regexString += '$';
        const regex = new RegExp(regexString);
        const rawRoutePath = path;
        return {
            path,
            handler: params => {
                if (lastView?.is(viewBuilder))
                    lastView.params.asMutable?.setValue(params);
                else
                    lastView = viewBuilder(params);
            },
            match: path => {
                const match = path.match(regex);
                if (!match)
                    return undefined;
                const params = {};
                for (let i = 0; i < varGroups.length; i++) {
                    const groupName = varGroups[i];
                    const group = match[i + 1];
                    if (group === undefined) {
                        console.warn(`${rawRoutePath} matched, but $${groupName} was unset`);
                        return undefined;
                    }
                    params[groupName] = group;
                }
                return params;
            },
        };
    }
    exports.default = Route;
});
define("component/core/Paragraph", ["require", "exports", "kitsui"], function (require, exports, kitsui_21) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_21.Component)(component => {
        return component.style('paragraph');
    });
});
define("component/core/Lore", ["require", "exports", "component/core/Paragraph", "kitsui"], function (require, exports, Paragraph_1, kitsui_22) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Paragraph_1 = __importDefault(Paragraph_1);
    exports.default = (0, kitsui_22.Component)(component => component.and(Paragraph_1.default).style('lore'));
});
define("component/item/Power", ["require", "exports", "kitsui", "Relic"], function (require, exports, kitsui_23, Relic_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Relic_4 = __importDefault(Relic_4);
    const prismaticIcon = kitsui_23.State.Async(kitsui_23.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_4.default.connected;
        const loadoutIcon = await conduit.definitions.en.DestinyLoadoutIconDefinition.get(814121290);
        return loadoutIcon?.iconImagePath;
    });
    exports.default = (0, kitsui_23.Component)((component, power, collections) => {
        collections = kitsui_23.State.get(collections);
        component.style('power');
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        const primaryDamageType = kitsui_23.State.Map(component, [power, collections], (power, collections) => collections.damageTypes[power?.damageTypes?.[0]]);
        const damageTypes = power.map(component, power => power?.damageTypes, (a, b) => a?.toSorted().join(',') === b?.toSorted().join(','));
        function getDamageTypeName(damageType) {
            const def = damageType === undefined ? undefined : collections.value.damageTypes[damageType];
            return def?.displayProperties.name.toLowerCase();
        }
        (0, kitsui_23.Component)()
            .style('power-damage-icon')
            .tweak(wrapper => {
            wrapper.style.bindFrom(damageTypes.map(wrapper, damageTypes => damageTypes?.length !== 1 ? undefined : `power-damage-icon--solo-${getDamageTypeName(damageTypes[0])?.toLowerCase()}`));
            kitsui_23.State.Use(wrapper, { primaryDamageType, damageTypes, prismaticIcon }).use(wrapper, ({ damageTypes, prismaticIcon }) => {
                wrapper.removeContents();
                wrapper.style.remove('power-damage-icon--1', 'power-damage-icon--2', 'power-damage-icon--3');
                if (damageTypes?.length === 5) {
                    wrapper.style('power-damage-icon--1');
                    (0, kitsui_23.Component)()
                        .style('power-damage-icon-image', 'power-damage-icon-image--prismatic')
                        .style.bindVariable('power-damage-image', `url(https://www.bungie.net${prismaticIcon})`)
                        .appendTo(wrapper);
                    const gradientFixer = (0, kitsui_23.Component)()
                        .style('power-damage-icon-image-prismatic-gradient-fixer')
                        .appendTo(wrapper);
                    for (let i = 0; i < 4; i++)
                        (0, kitsui_23.Component)()
                            .style('power-damage-icon-image', 'power-damage-icon-image--prismatic')
                            .style.bindVariable('power-damage-image', `url(https://www.bungie.net${prismaticIcon})`)
                            .appendTo(gradientFixer);
                    return;
                }
                wrapper.style(`power-damage-icon--${damageTypes?.length ?? 1}`);
                for (const damageType of damageTypes ?? []) {
                    const def = collections.value.damageTypes[damageType];
                    const damageTypeName = def.displayProperties.name.toLowerCase();
                    (0, kitsui_23.Component)()
                        .style('power-damage-icon-image', `power-damage-icon-image--${damageTypeName}`)
                        .style.bindVariable('power-damage-image', `url(https://www.bungie.net${def.displayProperties.icon})`)
                        .appendTo(wrapper);
                }
            });
        })
            .appendToWhen(primaryDamageType.truthy, component);
        (0, kitsui_23.Component)()
            .style('power-power')
            .tweak(wrapper => {
            damageTypes.use(wrapper, (damageTypes = []) => {
                const single = damageTypes.length === 5 || damageTypes.length <= 1;
                wrapper.style.toggle(single, 'power-power--colour');
                wrapper.style.toggle(!single, 'power-power--gradient');
                const damageTypeColourVars = damageTypes
                    .map(type => collections.value.damageTypes[type]?.displayProperties.name.toLowerCase())
                    .map(name => `var(--colour-damage-${name ?? 'kinetic'})`);
                wrapper.style.setVariable('power-damage-colour', damageTypes.length === 5 ? 'var(--colour-damage-prismatic)' : damageTypeColourVars[0]);
                const gradient = damageTypes.length === 1 ? damageTypeColourVars[0]
                    : damageTypes.length === 2 ? `${damageTypeColourVars[0]} 30%, ${damageTypeColourVars[1]} 70%`
                        : damageTypes.length === 3 ? `${damageTypeColourVars[0]} 20%, ${damageTypeColourVars[1]} 45%, ${damageTypeColourVars[1]} 55%, ${damageTypeColourVars[2]} 80%`
                            : `${damageTypeColourVars[0]} 20%, ${damageTypeColourVars[1]} 40%, ${damageTypeColourVars[2]} 60%, ${damageTypeColourVars[3]} 80%`;
                wrapper.style.setVariable('power-damage-gradient', `linear-gradient(130deg in oklab, ${gradient}`);
            });
        })
            .text.set('10')
            .appendTo(component);
        return component;
    });
});
define("component/item/Stats", ["require", "exports", "kitsui"], function (require, exports, kitsui_24) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const STATS_FILTERED_OUT = new Set([
        4043523819 /* StatHashes.Impact */,
        1345609583 /* StatHashes.AimAssistance */,
        3555269338 /* StatHashes.Zoom */,
        2714457168 /* StatHashes.AirborneEffectiveness */,
        1931675084 /* StatHashes.AmmoGeneration */,
        2715839340 /* StatHashes.RecoilDirection */,
    ]);
    const Stats = (0, kitsui_24.Component)((component, item, collections, display) => {
        item = kitsui_24.State.get(item);
        collections = kitsui_24.State.get(collections);
        component.style('stats');
        const statsVisible = (0, kitsui_24.State)(false);
        const hasStats = (0, kitsui_24.State)(false);
        const isAbbreviated = (0, kitsui_24.State)(false);
        kitsui_24.State.Use(component, { item, collections, isAbbreviated }, ({ item, collections, isAbbreviated }) => {
            component.removeContents();
            let _barStatsWrapper;
            let _numericStatsWrapper;
            const barStatsWrapper = () => _barStatsWrapper ??= (0, kitsui_24.Component)().style('stats-section').tweak(display?.tweakStatSection).prependTo(component);
            const numericStatsWrapper = () => _numericStatsWrapper ??= (0, kitsui_24.Component)().style('stats-section').tweak(display?.tweakStatSection).appendTo(component);
            // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
            const statGroupDef = collections.statGroups[item?.statGroupHash];
            const stats = !item?.stats ? [] : Object.values(item.stats)
                .sort((a, b) => 0
                || +(a.displayAsNumeric ?? false) - +(b.displayAsNumeric ?? false)
                || (statGroupDef && ((statGroupDef.scaledStats.findIndex(stat => stat.statHash === a.hash) ?? 0) - (statGroupDef.scaledStats.findIndex(stat => stat.statHash === b.hash) ?? 0)))
                || (collections.stats[a.hash]?.index ?? 0) - (collections.stats[b.hash]?.index ?? 0));
            hasStats.value = statGroupDef ? !!statGroupDef.scaledStats.length : !!stats.length;
            let hasVisibleStat = false;
            for (const stat of stats) {
                const def = collections.stats[stat.hash];
                const overrideDisplayProperties = statGroupDef?.overrides?.[stat.hash]?.displayProperties;
                const statName = (overrideDisplayProperties ?? def?.displayProperties)?.name ?? '';
                if (!statName || (item.is === 'item' && isAbbreviated && STATS_FILTERED_OUT.has(stat.hash)))
                    continue;
                hasVisibleStat = true;
                (0, kitsui_24.Component)()
                    .style('stats-stat')
                    .append((0, kitsui_24.Component)()
                    .style('stats-stat-label')
                    .text.set(statName)
                    .tweak(display?.tweakStatLabel, def, stat))
                    .append(!stat.displayAsNumeric && (0, kitsui_24.Component)()
                    .style('stats-stat-bar')
                    .style.toggle(stat.value < 0, 'stats-stat-bar--negative')
                    .style.setVariable('stats-stat-bar-progress', stat.value / (stat.max ?? 100))
                    .tweak(display?.tweakStatBar, def, stat))
                    .append((0, kitsui_24.Component)()
                    .style('stats-stat-value')
                    .text.set((item.is === 'plug' && stat.value >= 0 ? '+' : '') + stat.value.toLocaleString(navigator.language))
                    .tweak(display?.tweakStatValue, def, stat))
                    .tweak(display?.tweakStatWrapper)
                    .appendTo(stat.displayAsNumeric ? numericStatsWrapper() : barStatsWrapper());
            }
            statsVisible.value = hasVisibleStat;
        });
        return component.extend(stats => ({
            anyVisible: statsVisible,
            hasStats,
            isAbbreviated,
        }));
    });
    exports.default = Stats;
});
define("model/ArmourSet", ["require", "exports", "kitsui"], function (require, exports, kitsui_25) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = ArmourSet;
    function ArmourSet(owner, item, collections) {
        collections = kitsui_25.State.get(collections);
        return kitsui_25.State.Map(owner, [item, collections], (item, collections) => {
            const definition = item && collections.itemSets[item.itemSetHash];
            const perks = definition?.setPerks
                .sort((a, b) => a.requiredSetCount - b.requiredSetCount)
                .map(perk => ({ requiredSetCount: perk.requiredSetCount, definition: collections.perks[perk.sandboxPerkHash] }))
                .filter((perk) => !!perk.definition);
            return !definition ? undefined : {
                definition,
                perks: perks,
            };
        });
    }
});
define("utility/Categorisation", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Categorisation;
    (function (Categorisation) {
        Categorisation.IsMasterwork = matcher('Masterwork/*');
        Categorisation.IsIntrinsic = matcher('Intrinsic/*', '!Intrinsic/Shaped', '!Intrinsic/ArmorStat', '!Intrinsic/ArmorArchetype', '!Intrinsic/ArmorLegacy');
        Categorisation.IsIntrinsicPerk = matcher(...[
            'Intrinsic/Frame', 'Intrinsic/FrameEnhanced',
            'Intrinsic/Origin', 'Intrinsic/OriginEnhanced',
            'Intrinsic/Armor', 'Intrinsic/ArmorArtifice',
            'Intrinsic/Exotic', 'Masterwork/ExoticCatalyst',
        ]);
        Categorisation.IsPerk = matcher('Perk/*');
        Categorisation.IsEnhanced = matcher('*Enhanced');
        Categorisation.IsEmpty = matcher('*Empty*');
        Categorisation.IsDefault = matcher('*Default');
        Categorisation.IsShaderOrnament = matcher('Cosmetic/Shader', 'Cosmetic/Ornament');
        Categorisation.IsEmptyOrIncompleteCatalyst = matcher('Masterwork/ExoticCatalyst*', '!Masterwork/ExoticCatalyst');
        Categorisation.IsExoticCatalyst = matcher('Masterwork/ExoticCatalyst*');
        Categorisation.IsFrame = matcher('Intrinsic/Frame*');
        Categorisation.IsOrigin = matcher('Intrinsic/Origin*');
        function matcher(...expressions) {
            const positiveExpressions = expressions.filter(expr => expr[0] !== '!');
            const negativeExpressions = expressions.filter(expr => expr[0] === '!').map(expr => expr.slice(1));
            return function (categorised) {
                const categorisation = typeof categorised === 'string' ? categorised : categorised?.type;
                if (!categorisation)
                    return false;
                if (positiveExpressions.length && !matchesExpressions(categorisation, positiveExpressions))
                    return false;
                if (negativeExpressions.length && matchesExpressions(categorisation, negativeExpressions))
                    return false;
                return true;
            };
            function matchesExpressions(categorisation, expressions) {
                for (const expression of expressions) {
                    if (expression === categorisation)
                        return true;
                    if (expression.startsWith('*') && expression.endsWith('*'))
                        if (categorisation.includes(expression.slice(1, -1)))
                            return true;
                        else
                            continue;
                    if (expression.startsWith('*'))
                        if (categorisation.endsWith(expression.slice(1)))
                            return true;
                        else
                            continue;
                    if (expression.endsWith('*'))
                        if (categorisation.startsWith(expression.slice(0, -1)))
                            return true;
                        else
                            continue;
                    if (expression.includes('*')) {
                        const [start, end] = expression.split('*');
                        if (categorisation.startsWith(start) && categorisation.endsWith(end))
                            return true;
                        else
                            continue;
                    }
                }
                return false;
            }
        }
        Categorisation.matcher = matcher;
    })(Categorisation || (Categorisation = {}));
    exports.default = Categorisation;
});
define("utility/TooltipManager", ["require", "exports", "kitsui"], function (require, exports, kitsui_26) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function TooltipManager(componentBuilder, definition) {
        let instance;
        const states = new Proxy(definition.states, {
            get(target, p, receiver) {
                if (typeof p === 'string' && p.startsWith('update')) {
                    const name = `${p[6].toLowerCase()}${p.slice(7)}`;
                    return (value) => {
                        if (!target[name] || !instance)
                            return;
                        if (kitsui_26.State.is(value))
                            target[name].bind(instance, value);
                        else
                            target[name].value = value;
                    };
                }
                return target[p];
            },
        });
        const result = {
            apply(component, ...params) {
                const componentWithPopover = instance
                    ? component.setTooltip(instance)
                    : component.setTooltip(tooltip => instance ??= definition.build(states, tooltip, ...params));
                definition.apply?.(states, componentWithPopover, ...params);
                kitsui_26.State.Use(component, { focused: componentWithPopover.hoveredOrHasFocused, visible: componentWithPopover.popover.visible }).subscribe(component, ({ focused, visible }, { visible: oldVisible } = { focused: false, visible: false }) => {
                    if (focused && visible && !oldVisible) {
                        result.update(...params);
                        definition.onHover?.(states, ...params);
                    }
                });
            },
            update(...params) {
                definition.update(states, ...params);
            },
        };
        return Object.assign(componentBuilder, result);
    }
    exports.default = TooltipManager;
});
define("component/tooltip/ItemTooltip", ["require", "exports", "component/core/DisplaySlot", "component/core/Image", "component/core/Lore", "component/core/Paragraph", "component/item/Power", "component/item/Stats", "kitsui", "kitsui/component/Slot", "kitsui/component/Tooltip", "model/ArmourSet", "utility/Categorisation", "utility/Objects", "utility/TooltipManager"], function (require, exports, DisplaySlot_2, Image_3, Lore_1, Paragraph_2, Power_1, Stats_1, kitsui_27, Slot_4, Tooltip_1, ArmourSet_1, Categorisation_1, Objects_1, TooltipManager_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    DisplaySlot_2 = __importDefault(DisplaySlot_2);
    Image_3 = __importDefault(Image_3);
    Lore_1 = __importDefault(Lore_1);
    Paragraph_2 = __importDefault(Paragraph_2);
    Power_1 = __importDefault(Power_1);
    Stats_1 = __importDefault(Stats_1);
    Slot_4 = __importDefault(Slot_4);
    Tooltip_1 = __importDefault(Tooltip_1);
    ArmourSet_1 = __importDefault(ArmourSet_1);
    Categorisation_1 = __importDefault(Categorisation_1);
    TooltipManager_1 = __importDefault(TooltipManager_1);
    const PLUG_ARCHETYPE_ICON_SEQUENCE = 0;
    const PLUG_ARCHETYPE_ICON_SEQUENCE_FRAME = 1;
    const ItemTooltip = (0, kitsui_27.Component)((component, item, collections) => {
        const tooltip = component.as(Tooltip_1.default)
            .anchor.reset()
            .anchor.add('off right', 'sticky centre')
            .anchor.add('off left', 'sticky centre');
        const rarity = item.map(tooltip, item => collections.value.rarities[item.rarity]);
        const isCollections = item.map(tooltip, item => !item.instanceId);
        tooltip.style.bindFrom(rarity.map(tooltip, rarity => `item-tooltip--${rarity.displayProperties.name.toLowerCase()}`));
        ////////////////////////////////////
        //#region Header
        tooltip.header.style('item-tooltip-header');
        (0, kitsui_27.Component)()
            .style('item-tooltip-title')
            .text.bind(item.map(tooltip, item => item.displayProperties.name))
            .appendTo(tooltip.header);
        (0, kitsui_27.Component)()
            .style('item-tooltip-subtitle')
            .append((0, kitsui_27.Component)()
            .style('item-tooltip-subtitle-type')
            .text.bind(item.map(tooltip, item => item.type)))
            .append((0, kitsui_27.Component)()
            .style('item-tooltip-subtitle-rarity')
            .text.bind(rarity.map(tooltip, rarity => rarity.displayProperties.name)))
            .appendTo(tooltip.header);
        ////////////////////////////////////
        //#region Watermark
        const featured = item.map(tooltip, item => !!item.featuredWatermark);
        (0, kitsui_27.Component)()
            .style('item-tooltip-watermark')
            .style.bind(featured, 'item-tooltip-watermark--featured')
            .style.bindVariable('item-watermark', item.map(tooltip, item => `url(https://www.bungie.net${item.watermark})`))
            .appendTo(tooltip.header);
        const tier = item.map(tooltip, item => item.tier);
        (0, kitsui_27.Component)()
            .style('item-tooltip-watermark-tier')
            .style.bindFrom(tier.map(tooltip, tier => `item-tooltip-watermark-tier--${tier}`))
            .tweak(wrapper => {
            tier.use(wrapper, (tier = 0) => {
                wrapper.removeContents();
                for (let i = 0; i < tier; i++)
                    (0, kitsui_27.Component)()
                        .style('item-tooltip-watermark-tier-dot')
                        .appendTo(wrapper);
            });
        })
            .appendTo(tooltip.header);
        //#endregion
        ////////////////////////////////////
        //#endregion
        ////////////////////////////////////
        tooltip.body.style('item-tooltip-body');
        ////////////////////////////////////
        //#region Primary Info
        const primaryInfo = (0, kitsui_27.Component)()
            .style('item-tooltip-primary-info')
            .appendTo(tooltip.body);
        ////////////////////////////////////
        //#region Damage
        (0, Power_1.default)(kitsui_27.State.Use(primaryInfo, { damageTypes: item.map(primaryInfo, item => item.damageTypes) }), collections)
            .style('item-tooltip-damage')
            .appendTo(primaryInfo);
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Secondary Type
        const ammo = kitsui_27.State.Map(tooltip, [item, collections], (item, collections) => collections.ammoTypes[item.ammo]);
        const archetype = kitsui_27.State.Map(tooltip, [item, collections], (item, collections) => {
            const socketPlugHash = item.sockets.find(socket => socket.type === 'Intrinsic/ArmorArchetype')?.defaultPlugHash;
            return collections.plugs[socketPlugHash];
        });
        const secondaryType = kitsui_27.State.Map(tooltip, [archetype, ammo], (archetype, ammo) => {
            if (ammo?.displayProperties)
                return ammo.displayProperties;
            if (archetype?.displayProperties)
                return {
                    ...archetype.displayProperties,
                    icon: archetype.displayProperties.iconSequences?.[PLUG_ARCHETYPE_ICON_SEQUENCE]?.frames?.[PLUG_ARCHETYPE_ICON_SEQUENCE_FRAME]
                        ?? archetype.displayProperties.icon,
                };
        });
        (0, kitsui_27.Component)()
            .style('item-tooltip-type')
            .append((0, kitsui_27.Component)()
            .style('item-tooltip-type-icon')
            .style.bind(ammo.truthy, 'item-tooltip-type-icon--ammo')
            .style.bindVariable('item-tooltip-type-image', secondaryType.map(component, type => type && `url(https://www.bungie.net${type.icon})`)))
            .append((0, kitsui_27.Component)()
            .style('item-tooltip-type-label')
            .text.bind(secondaryType.map(component, type => type?.name)))
            .appendToWhen(secondaryType.truthy, primaryInfo);
        //#endregion
        ////////////////////////////////////
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Stats
        (0, kitsui_27.Component)()
            .style('item-tooltip-stats')
            .and(Stats_1.default, item, collections, { isAbbreviated: true })
            .tweak(stats => {
            stats.style.bind(stats.anyVisible.falsy, 'item-tooltip-stats--no-visible-stats');
            stats.appendToWhen(stats.hasStats, tooltip.body);
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Perks
        const perks = item.map(tooltip, item => item.sockets.filter(socket => Categorisation_1.default.IsIntrinsicPerk(socket) || Categorisation_1.default.IsPerk(socket)));
        const itemSet = (0, ArmourSet_1.default)(tooltip, item, collections);
        (0, kitsui_27.Component)()
            .style('item-tooltip-perks')
            .tweak(wrapper => {
            (0, Slot_4.default)().appendTo(wrapper).use(kitsui_27.State.Use(wrapper, { sockets: perks, itemSet, isCollections, collections }), (slot, { sockets, itemSet, isCollections, collections }) => {
                ////////////////////////////////////
                //#region Socket component
                const Plugs = (socket) => socket.plugs
                    .map(plugHash => collections.plugs[plugHash])
                    .filter(plug => !!plug);
                const Socket = (0, kitsui_27.Component)((wrapper, socket, plugs, noSocketed) => {
                    wrapper.style('item-tooltip-perks-perk');
                    plugs ??= Plugs(socket);
                    plugs = plugs
                        .filter(plug => !!plug)
                        .sort((a, b) => 0
                        || +!!b.displayProperties.name - +!!a.displayProperties.name
                        || +Categorisation_1.default.IsEnhanced(a) - +Categorisation_1.default.IsEnhanced(b));
                    const isCollectionsRoll = isCollections && plugs.length >= 4;
                    noSocketed = isCollectionsRoll ? noSocketed : false;
                    const socketed = noSocketed ? undefined : (Objects_1._
                        ?? collections.plugs[socket.defaultPlugHash]
                        ?? (!isCollectionsRoll ? plugs.at(0) : undefined));
                    if (!socketed?.displayProperties.name && !isCollectionsRoll && !noSocketed)
                        return;
                    if (socketed) {
                        (0, Image_3.default)(`https://www.bungie.net${socketed.displayProperties.icon}`)
                            .style('item-tooltip-perks-perk-icon')
                            .appendTo(wrapper);
                        (0, kitsui_27.Component)()
                            .style('item-tooltip-perks-perk-label')
                            .text.set(socketed.displayProperties.name)
                            .appendTo(wrapper);
                    }
                    const isSocketedEnhanced = Categorisation_1.default.IsEnhanced(socketed);
                    const additionalPlugs = plugs.filter(plug => true
                        && plug.hash !== socketed?.hash
                        && (isSocketedEnhanced || !Categorisation_1.default.IsEnhanced(plug))
                        && !Categorisation_1.default.IsEmpty(plug));
                    for (const plug of additionalPlugs)
                        (0, Image_3.default)(`https://www.bungie.net${plug.displayProperties.icon}`)
                            .style('item-tooltip-perks-perk-icon')
                            .appendTo(wrapper);
                    return wrapper;
                });
                //#endregion
                ////////////////////////////////////
                ////////////////////////////////////
                //#region Intrinsics
                // frame, origin, artifice, armour set perk (pre set bonuses, think iron banner perks)
                const intrinsics = sockets.filter(socket => !Categorisation_1.default.IsPerk(socket) && !Categorisation_1.default.IsExoticCatalyst(socket));
                for (const socket of intrinsics)
                    Socket(socket)
                        ?.style('item-tooltip-perks-perk--intrinsic')
                        .appendTo(slot);
                //#endregion
                ////////////////////////////////////
                ////////////////////////////////////
                //#region Catalyst
                const exoticCatalyst = sockets.find(Categorisation_1.default.IsExoticCatalyst);
                if (exoticCatalyst && (isCollections || false)) {
                    const realCatalystPlug = exoticCatalyst.plugs.map(plugHash => collections.plugs[plugHash]).find(plug => plug.type === 'Masterwork/ExoticCatalyst');
                    const perks = (realCatalystPlug?.perks ?? []).map(perkHash => collections.perks[perkHash]).filter(perk => !!perk);
                    for (const perk of perks) {
                        (0, kitsui_27.Component)()
                            .style('item-tooltip-perks-perk', 'item-tooltip-perks-perk--intrinsic')
                            .append((0, Image_3.default)(`https://www.bungie.net${perk.displayProperties.icon}`)
                            .style('item-tooltip-perks-perk-icon'))
                            .append((0, kitsui_27.Component)()
                            .style('item-tooltip-perks-perk-label')
                            .text.set(perk.displayProperties.name))
                            .appendTo(slot);
                    }
                }
                //#endregion
                ////////////////////////////////////
                ////////////////////////////////////
                //#region Set Bonuses
                if (itemSet) {
                    (0, kitsui_27.Component)()
                        .style('item-tooltip-perks-perk', 'item-tooltip-perks-perk--intrinsic')
                        .append((0, kitsui_27.Component)()
                        .style('item-tooltip-perks-perk-label', 'item-tooltip-perks-perk-label--set-bonus')
                        .text.set(itemSet.definition.displayProperties.name))
                        .append(...itemSet.perks.map(perk => (0, Image_3.default)(`https://www.bungie.net${perk.definition.displayProperties.icon}`)
                        .style('item-tooltip-perks-perk-icon')))
                        .appendTo(slot);
                }
                //#endregion
                ////////////////////////////////////
                ////////////////////////////////////
                //#region Perks
                const perks = sockets.filter(Categorisation_1.default.IsPerk);
                for (const socket of perks)
                    Socket(socket, undefined, isCollections)
                        ?.appendTo(slot);
                //#endregion
                ////////////////////////////////////
            });
        })
            .appendTo(tooltip.body);
        //#endregion
        ////////////////////////////////////
        const flavourText = item.map(tooltip, item => item.flavorText);
        (0, kitsui_27.Component)()
            .style('item-tooltip-flavour-text-wrapper')
            .append((0, Lore_1.default)().style('item-tooltip-flavour-text').text.bind(flavourText))
            .appendToWhen(flavourText.truthy, tooltip.extra);
        ////////////////////////////////////
        //#region Sources
        const sourceList = (0, DisplaySlot_2.default)()
            .style('item-tooltip-source-list')
            .appendTo(tooltip.extra);
        sourceList.use({ item, collections }, (slot, { item, collections }) => {
            const sources = item.sources;
            if (!sources?.length)
                return;
            const SourceWrapper = (0, kitsui_27.Component)((component, display) => {
                const icon = !display.icon ? undefined
                    : (0, Image_3.default)(`https://www.bungie.net${display.icon}`).style('item-tooltip-source-icon');
                const title = (0, kitsui_27.Component)()
                    .style('item-tooltip-source-title')
                    .text.set(display.name);
                const subtitle = !display.subtitle ? undefined : (0, kitsui_27.Component)()
                    .style('item-tooltip-source-subtitle')
                    .text.set(display.subtitle);
                return component
                    .style('item-tooltip-source')
                    .style.toggle(!!display.icon, 'item-tooltip-source--has-icon')
                    .append(icon, title, subtitle)
                    .extend(wrapper => ({
                    icon, title, subtitle,
                }))
                    .tweak(display.tweak);
            });
            let displayIndex = 0;
            for (const source of sources) {
                const display = resolveDisplay(source);
                if (!display)
                    continue;
                SourceWrapper(display)
                    .style.toggle(!!displayIndex++, 'item-tooltip-source--additional')
                    .appendTo(slot);
            }
            function resolveDisplay(sourceRef) {
                switch (sourceRef.type) {
                    case 'defined': {
                        const source = collections.sources[sourceRef.id];
                        const displayProperties = source?.displayProperties;
                        if (!displayProperties?.name)
                            return undefined;
                        let subtitle = Objects_1._
                            ?? (source.category === 1 /* DeepsightItemSourceCategory.ActivityReward */ ? quilt => quilt['item-tooltip/source/type/activity-reward']() : undefined)
                            ?? (source.category === 2 /* DeepsightItemSourceCategory.EventReward */ ? quilt => quilt['item-tooltip/source/type/event-reward']() : undefined)
                            ?? (source.category === 4 /* DeepsightItemSourceCategory.EventVendor */ ? quilt => quilt['item-tooltip/source/type/event-vendor']() : undefined)
                            ?? (source.category === 0 /* DeepsightItemSourceCategory.Vendor */
                                ? quilt => quilt[source.rotates ? 'item-tooltip/source/type/vendor-rotation' : 'item-tooltip/source/type/vendor']()
                                : undefined);
                        if (source.displayProperties.subtitle) {
                            const baseSubtitle = subtitle;
                            subtitle = quilt => quilt['item-tooltip/source/subtitle'](displayProperties.subtitle, typeof baseSubtitle === 'function' ? baseSubtitle(quilt) : baseSubtitle);
                        }
                        const icon = displayProperties.icon;
                        return {
                            name: displayProperties.name,
                            subtitle,
                            icon,
                        };
                    }
                    case 'table': {
                        const table = collections.dropTables[sourceRef.id];
                        if (!table?.displayProperties?.name)
                            return undefined;
                        return {
                            name: table.displayProperties.name,
                            subtitle: table.type === 'bonus-focus' ? quilt => quilt['item-tooltip/source/type/bonus-focus']() : table.displayProperties.description,
                            icon: table.displayProperties.icon,
                            tweak: wrapper => {
                                if (table.type === 'raid' || table.type === 'dungeon')
                                    wrapper.subtitle?.style('item-tooltip-source-subtitle--lore');
                                const mainDropTableEntry = table.dropTable?.[item.hash];
                                const realEncounters = (table.encounters ?? []).filter(encounter => !encounter.traversal);
                                const encountersDroppingItem = realEncounters
                                    .filter(encounter => mainDropTableEntry || encounter.dropTable?.[item.hash]);
                                let displayIndex = 0;
                                for (const encounter of encountersDroppingItem) {
                                    if (!encounter.displayProperties.name)
                                        continue;
                                    const encounterIndex = realEncounters.indexOf(encounter) + 1;
                                    // const dropTableEntry = mainDropTableEntry ?? encounter.dropTable?.[item.hash as never]
                                    const display = {
                                        name: encounter.displayProperties.name,
                                        subtitle: encounter.displayProperties.description ?? encounter.displayProperties.directive,
                                        icon: encounter.displayProperties.icon,
                                    };
                                    const encounterWrapper = SourceWrapper(display)
                                        .style('item-tooltip-source-encounter')
                                        .style.toggle(!!displayIndex++, 'item-tooltip-source-encounter--additional')
                                        .appendTo(wrapper);
                                    encounterWrapper.title.style('item-tooltip-source-encounter-title');
                                    encounterWrapper.subtitle?.style('item-tooltip-source-encounter-subtitle', 'item-tooltip-source-subtitle--lore');
                                    (0, kitsui_27.Component)()
                                        .style('item-tooltip-source-icon', 'item-tooltip-source-encounter-number')
                                        .text.set(`${encounterIndex}`)
                                        .insertTo(encounterWrapper, 'after', encounterWrapper.icon);
                                    encounterWrapper.icon?.remove();
                                }
                            },
                        };
                    }
                }
            }
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Armour Set Details
        (0, kitsui_27.Component)()
            .style('item-tooltip-armour-set-details')
            .tweak(details => details
            .append((0, kitsui_27.Component)()
            .style('item-tooltip-armour-set-details-title')
            .append((0, kitsui_27.Component)()
            .style('item-tooltip-armour-set-details-title-text')
            .text.bind(itemSet.map(details, itemSet => itemSet?.definition.displayProperties.name))))
            .append((0, DisplaySlot_2.default)().style('item-tooltip-armour-set-details-perk-list').use(itemSet, (slot, itemSet) => {
            if (!itemSet?.perks.length)
                return;
            for (const perk of itemSet.perks)
                (0, kitsui_27.Component)()
                    .style('item-tooltip-armour-set-details-perk')
                    .append((0, Image_3.default)(`https://www.bungie.net${perk.definition.displayProperties.icon}`)
                    .style('item-tooltip-armour-set-details-perk-icon'))
                    .append((0, kitsui_27.Component)()
                    .style('item-tooltip-armour-set-details-perk-label')
                    .append((0, kitsui_27.Component)()
                    .style('item-tooltip-armour-set-details-perk-label-title')
                    .text.set(perk.definition.displayProperties.name))
                    .append((0, kitsui_27.Component)()
                    .style('item-tooltip-armour-set-details-perk-label-separator')
                    .text.set('/'))
                    .append((0, kitsui_27.Component)()
                    .style('item-tooltip-armour-set-details-perk-label-requirement')
                    .text.set(quilt => quilt['item-tooltip/armour-set/perk-requirement'](perk.requiredSetCount, 5))))
                    .append((0, Paragraph_2.default)()
                    .style('item-tooltip-armour-set-details-perk-description')
                    .text.set(perk.definition.displayProperties.description))
                    .appendTo(slot);
        })))
            .appendToWhen(itemSet.truthy, tooltip.extra);
        //#endregion
        ////////////////////////////////////
        kitsui_27.State.Use(tooltip, { item, collections }, () => tooltip.rect.markDirty());
        return tooltip;
    });
    exports.default = (0, TooltipManager_1.default)(ItemTooltip, {
        states: {
            item: undefined,
            collections: undefined,
        },
        update(states, plug, collections) {
            states.updateItem(plug);
            states.updateCollections(collections);
        },
        build(states, tooltip, item, collections) {
            item = kitsui_27.State.get(item);
            collections = kitsui_27.State.get(collections);
            return tooltip.and(ItemTooltip, states.item ??= kitsui_27.State.Mutable(tooltip, item), states.collections ??= kitsui_27.State.Mutable(tooltip, collections));
        },
        onHover(states, item, collections) {
            item = kitsui_27.State.value(item);
            console.log(item.displayProperties.name, item);
        },
    });
});
define("component/item/Item", ["require", "exports", "component/core/Button", "component/core/Image", "component/tooltip/ItemTooltip", "kitsui"], function (require, exports, Button_4, Image_4, ItemTooltip_1, kitsui_28) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_4 = __importDefault(Button_4);
    Image_4 = __importDefault(Image_4);
    ItemTooltip_1 = __importDefault(ItemTooltip_1);
    const Item = Object.assign((0, kitsui_28.Component)((component, item, collections) => {
        item = kitsui_28.State.get(item);
        collections = kitsui_28.State.get(collections);
        const masterworked = item.map(component, item => false);
        const featured = item.map(component, item => !!item.featuredWatermark);
        const rarity = item.map(component, item => collections.value.rarities[item.rarity]);
        component.and(Button_4.default);
        component.style('item');
        component.style.bindFrom(rarity.map(component, rarity => `item--${rarity.displayProperties.name.toLowerCase()}`));
        component.style.bind(masterworked, 'item--masterworked');
        (0, kitsui_28.Component)()
            .style('item-border')
            .style.bind(masterworked, 'item-border--masterworked')
            .appendTo(component);
        (0, kitsui_28.Component)()
            .style('item-image-background')
            .append((0, Image_4.default)(item.map(component, item => `https://www.bungie.net${item.displayProperties.icon}`))
            .style('item-image'))
            .appendTo(component);
        (0, kitsui_28.Component)()
            .style('item-watermark')
            .style.bind(featured, 'item-watermark--featured')
            .style.bindVariable('item-watermark', item.map(component, item => `url(https://www.bungie.net${item.watermark})`))
            .appendTo(component);
        (0, kitsui_28.Component)()
            .style('item-border-glow')
            .style.bind(masterworked, 'item-border-glow--masterworked')
            .appendTo(component);
        ItemTooltip_1.default.apply(component, item, collections);
        component.event.subscribe('contextmenu', event => {
            event.preventDefault();
            if (!item.value.instanceId)
                void navigate.toURL(`/collections/${item.value.refNames.moment}/${item.value.refNames.item}`);
            else
                throw new Error('Cannot navigate to an item instance view yet');
        });
        return component.extend(itemComponent => ({
            item,
        }));
    }), {
        Tooltip: undefined,
    });
    exports.default = Item;
});
define("component/tooltip/GenericTooltip", ["require", "exports", "kitsui", "kitsui/component/Tooltip", "utility/TooltipManager"], function (require, exports, kitsui_29, Tooltip_2, TooltipManager_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Tooltip_2 = __importDefault(Tooltip_2);
    TooltipManager_2 = __importDefault(TooltipManager_2);
    const GenericTooltipBuilder = (0, kitsui_29.Component)((component) => {
        const tooltip = component.style('generic-tooltip').as(Tooltip_2.default).anchor.reset();
        tooltip.header.style('generic-tooltip-header');
        const title = (0, kitsui_29.Component)()
            .style('generic-tooltip-title')
            .appendTo(tooltip.header);
        tooltip.body.style('generic-tooltip-body');
        const description = (0, kitsui_29.Component)()
            .style('generic-tooltip-description')
            .appendTo(tooltip.body);
        return tooltip.extend(tooltip => ({
            title,
            titleText: title.text.rehost(tooltip),
            description,
            descriptionText: description.text.rehost(tooltip),
        }));
    });
    const GenericTooltip = (0, TooltipManager_2.default)(GenericTooltipBuilder, {
        states: {
            applicator: undefined,
        },
        update(states, applicator) {
            states.updateApplicator(applicator);
        },
        build(states, tooltip, applicator) {
            return tooltip.and(GenericTooltipBuilder).tweak(tooltip => {
                states.applicator ??= (0, kitsui_29.State)(applicator);
                states.applicator.use(tooltip, tooltip.tweak);
            });
        },
    });
    exports.default = GenericTooltip;
});
define("component/tooltip/PlugTooltip", ["require", "exports", "component/core/DisplaySlot", "component/core/Icon", "component/core/Image", "component/item/Stats", "kitsui", "kitsui/component/Tooltip", "style/icons", "utility/TooltipManager"], function (require, exports, DisplaySlot_3, Icon_2, Image_5, Stats_2, kitsui_30, Tooltip_3, icons_2, TooltipManager_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    DisplaySlot_3 = __importDefault(DisplaySlot_3);
    Icon_2 = __importDefault(Icon_2);
    Image_5 = __importDefault(Image_5);
    Stats_2 = __importDefault(Stats_2);
    Tooltip_3 = __importDefault(Tooltip_3);
    TooltipManager_3 = __importDefault(TooltipManager_3);
    const CLARITY_CLASS_ICON_MAP = {
        heavy: 'AmmoHeavy',
        primary: 'AmmoPrimary',
        special: 'AmmoSpecial',
        arc: 'DamageArc',
        kinetic: 'DamageKinetic',
        prismatic: 'DamagePrismatic',
        solar: 'DamageSolar',
        stasis: 'DamageStasis',
        strand: 'DamageStrand',
        void: 'DamageVoid',
        power: 'Power',
    };
    const PlugTooltip = (0, kitsui_30.Component)((component, plug, collections) => {
        const tooltip = component.as(Tooltip_3.default)
            .anchor.reset()
            .anchor.add('off right', 'sticky centre')
            .anchor.add('off left', 'sticky centre');
        ////////////////////////////////////
        //#region Header
        tooltip.header.style('item-tooltip-header', 'plug-tooltip-header');
        (0, kitsui_30.Component)()
            .style('item-tooltip-title')
            .text.bind(plug.map(tooltip, plug => plug.displayProperties.name))
            .appendTo(tooltip.header);
        (0, kitsui_30.Component)()
            .style('item-tooltip-subtitle')
            .append((0, kitsui_30.Component)()
            .style('item-tooltip-subtitle-type')
            .text.bind(plug.map(tooltip, plug => plug.type)))
            // .append(Component()
            // 	.style('item-tooltip-subtitle-rarity')
            // 	.text.bind(rarity.map(tooltip, rarity => rarity.displayProperties.name))
            // )
            .appendTo(tooltip.header);
        //#endregion
        ////////////////////////////////////
        tooltip.body.style('item-tooltip-body');
        (0, kitsui_30.Component)()
            .style('plug-tooltip-description')
            .append((0, kitsui_30.Component)()
            .style('plug-tooltip-description-content')
            .text.bind(plug.map(tooltip, plug => plug.displayProperties.description)))
            .appendTo(tooltip.body);
        (0, kitsui_30.Component)()
            .style('item-tooltip-stats', 'plug-tooltip-stats')
            .and(Stats_2.default, plug, collections)
            .tweak(stats => {
            stats.style.bind(stats.anyVisible.falsy, 'item-tooltip-stats--no-visible-stats');
            stats.appendToWhen(stats.hasStats, tooltip.body);
        });
        const clarity = plug.map(component, plug => plug.clarity);
        (0, DisplaySlot_3.default)().style('plug-tooltip-clarity').appendToWhen(clarity.truthy, tooltip.body).use(clarity, (slot, clarity) => {
            if (!clarity?.descriptions.length)
                return;
            (0, kitsui_30.Component)()
                .style('plug-tooltip-clarity-header')
                .append((0, Image_5.default)('https://avatars.githubusercontent.com/u/117947315?s=48&v=4').style('plug-tooltip-clarity-header-icon'))
                .append((0, kitsui_30.Component)().style('plug-tooltip-clarity-header-name').text.set('Clarity'))
                .text.append(' / Community Insights')
                .appendTo(slot);
            const clarityComponents = {
                icon: (component, data) => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                    const iconKey = CLARITY_CLASS_ICON_MAP[data.classNames?.[0]];
                    return !iconKey ? undefined : (component
                        .style('plug-tooltip-clarity-icon')
                        .append(Icon_2.default[iconKey].style(`plug-tooltip-clarity-icon--${icons_2.Icons[iconKey]}`)));
                },
                table: (component, data) => (component
                    .style('plug-tooltip-clarity-table')
                    .append(...ClarityChildren(data.rows, data))),
                tableRow: (component, data) => (component
                    .style('plug-tooltip-clarity-table-row')
                    .append(...ClarityChildren(data.cells, data))),
                tableCell: (component, data) => (component
                    .style('plug-tooltip-clarity-table-cell')
                    .style.toggle(!!data.isNumeric, 'plug-tooltip-clarity-table-cell--numeric')),
                text: (component, data) => (component
                    .style('plug-tooltip-clarity-text')),
                numeric: (component, data) => (component
                    .style('plug-tooltip-clarity-numeric')
                    .style.toggle(!!data.isEstimate, 'plug-tooltip-clarity-numeric--estimate')
                    .style.toggle(!!data.isUnknown, 'plug-tooltip-clarity-numeric--unknown')),
                stackSeparator: (component, data) => (component
                    .style('plug-tooltip-clarity-stack-separator')
                    .text.set('/')),
                line: (component, data, { siblings }, previousData = previousSibling(siblings, data)) => (component
                    .style('plug-tooltip-clarity-line')
                    .style.toggle(!!data.isEnhanced, 'plug-tooltip-clarity-line--enhanced')
                    .style.toggle(!!data.isLabel, 'plug-tooltip-clarity-line--label')
                    .style.toggle(!!data.isListItem, 'plug-tooltip-clarity-line--list-item')
                    .style.toggle(!!data.isListItem && previousData?.type === 'line' && !!previousData.isLabel, 'plug-tooltip-clarity-line--list-item--after-label')),
                labelledLine: (component, data, { siblings }, previousData = previousSibling(siblings, data)) => (component
                    .style('plug-tooltip-clarity-labelled-line')
                    .style.toggle(!!data.isListItem, 'plug-tooltip-clarity-line--list-item', 'plug-tooltip-clarity-labelled-line--list-item')
                    .style.toggle(!!data.isListItem && previousData?.type === 'line' && !!previousData.isLabel, 'plug-tooltip-clarity-line--list-item--after-label')
                    .style.toggle(Math.max(...adjacentLabelledLines(siblings, data).map(l => getLength(l))) < 48, 'plug-tooltip-clarity-labelled-line--simple')
                    .append((0, kitsui_30.Component)().style('plug-tooltip-clarity-labelled-line-label').append(...ClarityChildren(data.label, data)))
                    .append((0, kitsui_30.Component)().style('plug-tooltip-clarity-labelled-line-value').append(...ClarityChildren(data.value, data)))),
                pve: (component, data) => (component
                    .style('plug-tooltip-clarity-pvevp', 'plug-tooltip-clarity-pve')
                    .prepend((0, kitsui_30.Component)().style('plug-tooltip-clarity-pvevp-label').text.set(quilt => quilt['plug-tooltip/clarity/label-pve']()))),
                pvp: (component, data) => (component
                    .style('plug-tooltip-clarity-pvevp', 'plug-tooltip-clarity-pvp')
                    .prepend((0, kitsui_30.Component)().style('plug-tooltip-clarity-pvevp-label').text.set(quilt => quilt['plug-tooltip/clarity/label-pvp']()))),
                spacer: (component, data) => (component
                    .style('plug-tooltip-clarity-spacer')),
                enhancedArrow: (component, data) => (component
                    .style('plug-tooltip-clarity-enhanced-arrow')),
                definitionReference: (component, data) => (component
                    .style('plug-tooltip-clarity-definition-reference')),
            };
            const context = { type: 'context', siblings: clarity.descriptions };
            slot.append(...clarity.descriptions.map(desc => ClarityComponent(desc, context)));
            function applyClassNames(into, classNames) {
                into.attributes.set('data-clarity-class', classNames?.join(' '));
            }
            function ClarityChildren(children, context) {
                context = context?.type === 'context' ? context : context && { type: 'context', parent: context, siblings: children };
                return children.map(child => ClarityComponent(child, context));
            }
            function ClarityComponent(clarityComponent, context) {
                return (0, kitsui_30.Component)()
                    .tweak(applyClassNames, clarityComponent.classNames)
                    .text.set('text' in clarityComponent ? clarityComponent.text : '')
                    .append(...'content' in clarityComponent ? ClarityChildren(clarityComponent.content, context) : [])
                    .tweak(clarityComponents[clarityComponent.type], clarityComponent, context ?? { type: 'context', siblings: [] });
            }
            function previousSibling(siblings, component) {
                return siblings[siblings.indexOf(component) - 1];
            }
            function adjacentLabelledLines(siblings, line) {
                const indexOfLine = siblings.indexOf(line);
                if (indexOfLine === -1)
                    return [];
                const result = [];
                for (let i = indexOfLine - 1; i >= 0 && siblings[i].type === 'labelledLine'; i--)
                    result.unshift(siblings[i]);
                for (let i = indexOfLine + 1; i < siblings.length && siblings[i].type === 'labelledLine'; i++)
                    result.push(siblings[i]);
                return result;
            }
            function getLength(...components) {
                if (components.length !== 1)
                    return components.map(c => getLength(c)).reduce((a, b) => a + b, 0);
                const component = components[0];
                switch (component.type) {
                    case 'text':
                        return component.text.length;
                    case 'numeric':
                        return Math.ceil(component.text.length * 1.2);
                    case 'icon':
                    case 'enhancedArrow':
                        return 4;
                    case 'stackSeparator':
                        return 10;
                    case 'definitionReference':
                        // TODO
                        return 0;
                    case 'spacer':
                    case 'table':
                    case 'tableRow':
                        return 80;
                    case 'labelledLine':
                        return getLength(...component.label) + getLength(...component.value);
                    case 'line':
                    case 'tableCell':
                        return getLength(...component.content);
                    case 'pve':
                    case 'pvp':
                        return getLength(...component.content) + 4; // 4 for the label
                }
            }
        });
        return tooltip;
    });
    exports.default = (0, TooltipManager_3.default)(PlugTooltip, {
        states: {
            plug: undefined,
            collections: undefined,
        },
        update(states, plug, collections) {
            states.updatePlug(plug);
            states.updateCollections(collections);
        },
        build(states, tooltip, plug, collections) {
            plug = kitsui_30.State.get(plug);
            collections = kitsui_30.State.get(collections);
            return tooltip.and(PlugTooltip, states.plug ??= kitsui_30.State.Mutable(tooltip, plug), states.collections ??= kitsui_30.State.Mutable(tooltip, collections));
        },
        onHover(states, plug, collections) {
            plug = kitsui_30.State.value(plug);
            console.log(plug.displayProperties.name, plug);
        },
    });
});
define("component/overlay/ItemOverlay", ["require", "exports", "component/core/Image", "component/core/Lore", "component/item/Item", "component/item/Power", "component/item/Stats", "component/tooltip/GenericTooltip", "component/tooltip/PlugTooltip", "kitsui", "kitsui/component/Slot", "kitsui/utility/InputBus", "model/ArmourSet", "Relic", "utility/Categorisation"], function (require, exports, Image_6, Lore_2, Item_1, Power_2, Stats_3, GenericTooltip_1, PlugTooltip_1, kitsui_31, Slot_5, InputBus_2, ArmourSet_2, Relic_5, Categorisation_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Image_6 = __importDefault(Image_6);
    Lore_2 = __importDefault(Lore_2);
    Item_1 = __importDefault(Item_1);
    Power_2 = __importDefault(Power_2);
    Stats_3 = __importDefault(Stats_3);
    GenericTooltip_1 = __importDefault(GenericTooltip_1);
    PlugTooltip_1 = __importDefault(PlugTooltip_1);
    Slot_5 = __importDefault(Slot_5);
    InputBus_2 = __importDefault(InputBus_2);
    ArmourSet_2 = __importDefault(ArmourSet_2);
    Relic_5 = __importDefault(Relic_5);
    Categorisation_2 = __importDefault(Categorisation_2);
    const DestinySocketCategoryDefinition = kitsui_31.State.Async(async () => {
        const conduit = await Relic_5.default.connected;
        return await conduit.definitions.en.DestinySocketCategoryDefinition.all();
    });
    const PowerStatDefinition = kitsui_31.State.Async(async () => {
        const conduit = await Relic_5.default.connected;
        return await conduit.definitions.en.DestinyStatDefinition.get(1935470627 /* StatHashes.Power */);
    });
    exports.default = (0, kitsui_31.Component)((component, intendedItem, collections) => {
        // preserve all the ui for the last item when the "intended" item is set to undefined
        const item = (0, kitsui_31.State)(undefined);
        kitsui_31.State.get(intendedItem).use(component, intendedItem => item.value = intendedItem ?? item.value);
        collections = kitsui_31.State.get(collections);
        const overlay = component.style('item-overlay');
        const background = (0, kitsui_31.Component)().style('item-overlay-background').appendTo(overlay);
        (0, Image_6.default)(item.map(overlay, item => item?.previewImage && `https://www.bungie.net${item.previewImage}`))
            .style('item-overlay-image')
            .appendTo(background);
        (0, Image_6.default)(item.map(overlay, item => item?.foundryImage && `https://www.bungie.net${item.foundryImage}`))
            .style('item-overlay-foundry')
            .appendTo(background);
        const mainColumn = (0, kitsui_31.Component)()
            .style('item-overlay-column-content')
            .appendTo((0, kitsui_31.Component)()
            .style('item-overlay-column', 'item-overlay-column--main')
            .appendTo(overlay));
        ////////////////////////////////////
        //#region Display
        (0, kitsui_31.Component)()
            .style('item-overlay-header')
            .append((0, Slot_5.default)().use(item, (_, item) => item
            && (0, Item_1.default)(item, collections).style('item-overlay-icon')))
            .append((0, kitsui_31.Component)().style('item-overlay-title').text.bind(item.map(overlay, item => item?.displayProperties.name)))
            .append((0, kitsui_31.Component)().style('item-overlay-subtitle').text.bind(item.map(overlay, item => item?.type)))
            .appendTo(mainColumn);
        const flavourText = item.map(overlay, item => item?.flavorText);
        (0, Lore_2.default)()
            .style('item-overlay-lore')
            .text.bind(flavourText)
            .appendToWhen(flavourText.truthy, mainColumn);
        const SocketGroup = (0, kitsui_31.Component)((component, socket) => {
            component.style.bind(component.hoveredOrHasFocused, 'item-overlay-socket-group--hover');
            const def = typeof socket !== 'number'
                ? kitsui_31.State.get(socket)
                : DestinySocketCategoryDefinition.map(component, defs => defs?.[socket]);
            const header = (0, kitsui_31.Component)()
                .style('item-overlay-socket-group-header')
                .style.bind(component.hoveredOrHasFocused, 'item-overlay-socket-group-header--hover')
                .tweak(GenericTooltip_1.default.apply, tooltip => tooltip
                .titleText.bind(def.map(component, def => def?.displayProperties.name))
                .descriptionText.bind(def.map(component, def => def?.displayProperties.description)))
                .appendTo(component);
            const title = (0, kitsui_31.Component)()
                .style('item-overlay-socket-group-title')
                .text.bind(def.map(component, def => def?.displayProperties.name))
                .appendTo(header);
            const content = (0, kitsui_31.Component)()
                .style('item-overlay-socket-group-content')
                .style.bind(component.hoveredOrHasFocused, 'item-overlay-socket-group-content--hover')
                .appendTo(component);
            return component.style('item-overlay-socket-group').extend(group => ({
                header, title, content,
                titleText: title.text.rehost(group),
            }));
        });
        const ArmorSetPlugType = 'Intrinsic/ArmorSet';
        const Plug = (0, kitsui_31.Component)('button', (component, plug) => {
            const isPerk = Categorisation_2.default.IsPerk(plug) || Categorisation_2.default.IsOrigin(plug);
            const isFrame = Categorisation_2.default.IsFrame(plug);
            const isArmorSet = plug.type === ArmorSetPlugType;
            component.style('item-overlay-plug')
                .style.toggle(isPerk, 'item-overlay-plug--perk')
                .style.toggle(isFrame, 'item-overlay-plug--frame')
                .style.toggle(isArmorSet, 'item-overlay-plug--armorset')
                .style.bind(component.hoveredOrHasFocused, 'item-overlay-plug--hover');
            (0, kitsui_31.Component)()
                .style('item-overlay-plug-effect')
                .style.toggle(isPerk, 'item-overlay-plug-effect--perk')
                .style.toggle(isFrame, 'item-overlay-plug-effect--frame')
                .style.toggle(isArmorSet, 'item-overlay-plug-effect--armorset')
                .style.bind(component.hoveredOrHasFocused.map(component, hover => hover && isPerk), 'item-overlay-plug-effect--perk--hover')
                .style.bind(component.hoveredOrHasFocused.map(component, hover => hover && isFrame), 'item-overlay-plug-effect--frame--hover')
                .appendTo(component);
            (0, Image_6.default)(`https://www.bungie.net${plug.displayProperties.icon}`)
                .style('item-overlay-plug-icon')
                .appendTo(component);
            PlugTooltip_1.default.apply(component, plug, collections);
            return component;
        });
        const Socket = (0, kitsui_31.Component)((component, socket, collections) => {
            component.style('item-overlay-socket');
            for (const hash of socket.plugs) {
                const plug = collections.plugs[hash];
                if (Categorisation_2.default.IsEnhanced(plug))
                    continue;
                Plug(plug).appendTo(component);
            }
            return component;
        });
        ////////////////////////////////////
        //#region Weapon Perks
        const isWeapon = item.map(component, item => !!item?.categories?.includes(1 /* ItemCategoryHashes.Weapon */));
        SocketGroup(4241085061 /* SocketCategoryHashes.WeaponPerks_CategoryStyle1 */)
            .tweak(group => (0, Slot_5.default)().appendTo(group.content).use({ item, collections }, (slot, { item, collections }) => {
            const sockets = item?.sockets.filter(Categorisation_2.default.IsPerk) ?? [];
            if (!item?.instanceId)
                for (let i = 0; i < sockets.length; i++) {
                    if (i)
                        (0, kitsui_31.Component)().style('item-overlay-socket-group-gap').appendTo(slot);
                    Socket(sockets[i], collections)
                        .appendTo(slot);
                }
        }))
            .appendToWhen(isWeapon, mainColumn);
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Intrinsic Traits
        (0, Slot_5.default)().appendTo(mainColumn).use({ item, collections }, (slot, { item, collections }) => {
            const sockets = item?.sockets.filter(Categorisation_2.default.IsIntrinsic) ?? [];
            if (!sockets.length)
                return;
            SocketGroup(3956125808 /* SocketCategoryHashes.IntrinsicTraits */)
                .tweak(group => {
                if (!item?.instanceId) {
                    for (let i = 0; i < sockets.length; i++) {
                        if (i)
                            (0, kitsui_31.Component)().style('item-overlay-socket-group-gap').appendTo(slot);
                        const plug = collections.plugs[sockets[i].defaultPlugHash ?? sockets[i].plugs[0]];
                        Socket(sockets[i], collections)
                            .style('item-overlay-socket--intrinsic')
                            .append(!Categorisation_2.default.IsFrame(sockets[i]) || !plug ? undefined : (0, kitsui_31.Component)()
                            .style('item-overlay-socket-display')
                            .append((0, kitsui_31.Component)()
                            .style('item-overlay-socket-display-name')
                            .text.set(plug.displayProperties.name))
                            .append((0, kitsui_31.Component)()
                            .style('item-overlay-socket-display-description')
                            .text.set(plug.displayProperties.description)))
                            .appendTo(group.content);
                    }
                }
            })
                .appendTo(slot);
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Armour Set
        const itemSet = (0, ArmourSet_2.default)(component, item, collections);
        (0, Slot_5.default)().appendTo(mainColumn).use(itemSet, (slot, itemSet) => {
            if (!itemSet)
                return;
            return SocketGroup(itemSet.definition)
                .tweak(group => {
                for (let i = 0; i < itemSet.perks.length; i++) {
                    if (i)
                        (0, kitsui_31.Component)().style('item-overlay-socket-group-gap').appendTo(group.content);
                    const perk = itemSet.perks[i];
                    (0, kitsui_31.Component)()
                        .style('item-overlay-socket', 'item-overlay-socket--intrinsic')
                        .append(Plug({
                        is: 'plug',
                        hash: -1,
                        type: ArmorSetPlugType,
                        displayProperties: perk.definition.displayProperties,
                        enhanced: false,
                    }))
                        .append((0, kitsui_31.Component)()
                        .style('item-overlay-socket-display')
                        .append((0, kitsui_31.Component)()
                        .style('item-overlay-socket-display-name')
                        .text.set(perk.definition.displayProperties.name)
                        .append((0, kitsui_31.Component)()
                        .style('item-overlay-socket-armour-set-label-separator')
                        .text.set('/'))
                        .append((0, kitsui_31.Component)()
                        .style('item-overlay-socket-armour-set-label-requirement')
                        .text.set(quilt => quilt['item-tooltip/armour-set/perk-requirement'](perk.requiredSetCount, 5))))
                        .append((0, kitsui_31.Component)()
                        .style('item-overlay-socket-display-description')
                        .text.set(perk.definition.displayProperties.description)))
                        .appendTo(group.content);
                }
            });
        });
        //#endregion
        ////////////////////////////////////
        const sideColumn = (0, kitsui_31.Component)()
            .style('item-overlay-column-content', 'item-overlay-column-content--side')
            .appendTo((0, kitsui_31.Component)()
            .style('item-overlay-column', 'item-overlay-column--side')
            .appendTo(overlay));
        ////////////////////////////////////
        //#region Stats
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        const ammo = kitsui_31.State.Map(overlay, [item, collections], (item, collections) => collections.ammoTypes[item?.ammo]);
        const stats = (0, Stats_3.default)(item, collections, {
            tweakStatLabel: (label, def) => (label
                .style('item-overlay-stats-stat-label')
                .tweak(GenericTooltip_1.default.apply, tooltip => tooltip
                .titleText.set(def.displayProperties.name)
                .descriptionText.set(def.displayProperties.description))),
            tweakStatSection: section => section.style('item-overlay-stats-stat-section'),
        });
        (0, kitsui_31.Component)()
            .style('item-overlay-stats-wrapper')
            .tweak(c => c.style.bind(c.hoveredOrHasFocused, 'item-overlay-stats-wrapper--hover'))
            .append((0, kitsui_31.Component)()
            .style('item-overlay-stats-primary')
            .append((0, kitsui_31.Component)()
            .style('item-overlay-stats-primary-power')
            .append((0, kitsui_31.Component)()
            .style('item-overlay-stats-primary-power-label')
            .text.bind(PowerStatDefinition.map(stats, def => def?.displayProperties.name)))
            .append((0, Power_2.default)(kitsui_31.State.Use(stats, { damageTypes: item.map(stats, item => item?.damageTypes) }), collections)
            .style('item-overlay-stats-primary-power-display')))
            .appendWhen(ammo.truthy, (0, kitsui_31.Component)()
            .style('item-overlay-stats-primary-ammo')
            .append((0, Image_6.default)(ammo.mapManual(ammo => ammo && `https://www.bungie.net${ammo.displayProperties.icon}`))
            .style('item-overlay-stats-primary-ammo-icon'))
            .append((0, kitsui_31.Component)()
            .style('item-overlay-stats-primary-ammo-label')
            .text.bind(ammo.mapManual(ammo => ammo?.displayProperties.name)))))
            .appendWhen(stats.hasStats, stats
            .style('item-overlay-stats'))
            .appendTo(sideColumn);
        //#endregion
        ////////////////////////////////////
        InputBus_2.default.event.until(overlay, event => event.subscribe('Down', (_, event) => {
            if (event.use('Escape')) {
                if (!item?.value?.instanceId)
                    void navigate.toURL('/collections');
                else
                    throw new Error('Cannot navigate out of an item instance view yet');
            }
        }));
        return overlay;
    });
});
define("component/core/Details", ["require", "exports", "kitsui"], function (require, exports, kitsui_32) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Details = (0, kitsui_32.Component)('details', (component) => {
        const open = (0, kitsui_32.State)(false);
        const manualOpenState = (0, kitsui_32.State)(false);
        const transitioning = (0, kitsui_32.State)(false);
        const summary = (0, kitsui_32.Component)('summary').style('details-summary');
        const content = (0, kitsui_32.Component)().style('details-content').style.bind(open, 'details-content--open');
        let isAutoToggle = false;
        let isManualToggle = false;
        return component.replaceElement('details')
            .style('details')
            .style.bind(open, 'details--open')
            .append(summary, content)
            .extend(details => ({
            summary,
            summaryText: undefined,
            content,
            manualOpenState,
            open,
            transitioning,
        }))
            .extendJIT('summaryText', details => details.summary.text.rehost(details))
            .event.subscribe(['transitionstart', 'transitionend'], event => {
            if (event.propertyName !== '--details-dummy-transitioning')
                return;
            transitioning.value = event.type === 'transitionstart';
        })
            .event.subscribe('toggle', event => {
            if (isAutoToggle) {
                isAutoToggle = false;
                return;
            }
            isManualToggle = true;
            manualOpenState.value = open.value = event.host.element.open;
        })
            .tweak(details => {
            open.subscribe(details, () => {
                if (!isManualToggle)
                    isAutoToggle = true;
                details.element.open = open.value;
                isManualToggle = false;
            });
        });
    });
    exports.default = Details;
});
define("component/view/collections/Moment", ["require", "exports", "component/core/Details", "component/core/Image", "component/core/Lore", "component/item/Item", "kitsui"], function (require, exports, Details_1, Image_7, Lore_3, Item_2, kitsui_33) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Details_1 = __importDefault(Details_1);
    Image_7 = __importDefault(Image_7);
    Lore_3 = __importDefault(Lore_3);
    Item_2 = __importDefault(Item_2);
    const MomentBucket = (0, kitsui_33.Component)((component) => {
        component.style('collections-view-moment-bucket');
        const title = (0, kitsui_33.Component)()
            .style('collections-view-moment-bucket-title')
            .appendTo(component);
        const content = (0, kitsui_33.Component)()
            .style('collections-view-moment-bucket-content')
            .appendTo(component);
        return component.extend(bucket => ({
            title,
            titleText: undefined,
            content,
        }))
            .extendJIT('titleText', bucket => bucket.title.text.rehost(bucket));
    });
    exports.default = (0, kitsui_33.Component)((component, { moment, buckets }, collections, display) => {
        display = kitsui_33.State.get(display);
        const filterText = display.map(component, display => display?.filter.filterText);
        return component.and(Details_1.default)
            .tweak(details => {
            details
                .style('collections-view-moment')
                .style.bind(details.open, 'details--open', 'collections-view-moment--open')
                .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment--hover')
                .viewTransitionSwipe(`collections-view-moment-${moment.id}`);
            if (moment.primaryImage) {
                const url = `https://www.bungie.net${moment.primaryImage}`;
                const image = document.createElement('img');
                image.src = url;
                image.onload = e => {
                    details.style.setVariable('event-background', `url(${url})`);
                    details.style.setVariable('event-background-width', `${image.naturalWidth}`);
                    details.style.setVariable('event-background-height', `${image.naturalHeight}`);
                };
            }
        })
            .tweak(details => details.summary
            .style('collections-view-moment-summary')
            .style.bind(details.open, 'collections-view-moment-summary--open')
            .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment-summary--hover')
            .append(moment.iconWatermark && (0, kitsui_33.Component)()
            .style('collections-view-moment-icon', 'collections-view-moment-icon--watermark')
            .style.bind(details.open, 'collections-view-moment-icon--open')
            .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment-icon--hover')
            .style.setVariable('moment-watermark-icon', `url(https://www.bungie.net${moment.iconWatermark})`))
            .append(!moment.iconWatermark && moment.displayProperties.icon && (0, Image_7.default)(`https://www.bungie.net${moment.displayProperties.icon}`)
            .style('collections-view-moment-icon')
            .style.bind(details.open, 'collections-view-moment-icon--open')
            .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment-icon--hover'))
            .append((0, kitsui_33.Component)()
            .style('collections-view-moment-title')
            .style.bind(details.open, 'collections-view-moment-title--open')
            .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment-title--hover')
            .text.set(moment.displayProperties.name)))
            .tweak(details => {
            details.content.style('collections-view-moment-content');
            const weapons = [1498876634 /* InventoryBucketHashes.KineticWeapons */, 2465295065 /* InventoryBucketHashes.EnergyWeapons */, 953998645 /* InventoryBucketHashes.PowerWeapons */]
                .flatMap(hash => buckets[hash].items.map(hash => collections.items[hash]));
            const armour = [3448274439 /* InventoryBucketHashes.Helmet */, 3551918588 /* InventoryBucketHashes.Gauntlets */, 14239492 /* InventoryBucketHashes.ChestArmor */, 20886954 /* InventoryBucketHashes.LegArmor */, 1585787867 /* InventoryBucketHashes.ClassArmor */]
                .flatMap(hash => buckets[hash].items.map(hash => collections.items[hash]));
            const armourWarlock = armour.filter(item => item.class === 2 /* DestinyClass.Warlock */);
            const armourTitan = armour.filter(item => item.class === 0 /* DestinyClass.Titan */);
            const armourHunter = armour.filter(item => item.class === 1 /* DestinyClass.Hunter */);
            const ItemFilterState = (item) => kitsui_33.State.Map(details, [display, filterText], (display, _) => display?.filter.filter(item, false) ?? true);
            const itemFilterStates = new Map([...weapons, ...armour].map(item => [item, ItemFilterState(item)]));
            const hasAnyItemFilteredIn = kitsui_33.State.Some(details, ...itemFilterStates.values());
            kitsui_33.State.Use(details, { filterText, hasAnyItemFilteredIn }, ({ filterText, hasAnyItemFilteredIn }) => {
                if (!filterText) {
                    details.open.value = details.manualOpenState.value;
                    return;
                }
                details.open.value = hasAnyItemFilteredIn;
            });
            void details.open.await(details, true).then(() => {
                (0, Lore_3.default)()
                    .style('collections-view-moment-lore')
                    .text.set(moment.displayProperties.description)
                    .appendTo(details.content);
                const bucketsWrapper = (0, kitsui_33.Component)()
                    .style('collections-view-moment-buckets')
                    .appendTo(details.content);
                const addFilteredItems = (bucket, items) => {
                    const sortValues = Object.fromEntries(items.map(item => [
                        item.hash,
                        [
                            item.rarity,
                            (item.sources
                                ?.map(sourceRef => {
                                const def = sourceRef.type === 'table' ? collections.dropTables[sourceRef.id] : collections.sources[sourceRef.id];
                                return { ...sourceRef, def };
                            })
                                .filter(source => source.type !== 'table' || source.def.type === 'raid' || source.def.type === 'dungeon' || source.def.type === 'exotic-mission')
                                .map(source => `${source.type}:${source.id}`)
                                .join(',')
                                || ''),
                            item.itemSetHash,
                        ].map(v => v ?? 0),
                    ]));
                    items = items.toSorted((a, b) => {
                        const aValues = sortValues[a.hash];
                        const bValues = sortValues[b.hash];
                        for (let i = 0; i < aValues.length; i++)
                            if (aValues[i] !== bValues[i])
                                return typeof aValues[i] === 'number'
                                    ? aValues[i] - bValues[i]
                                    : +(aValues[i] === '') - +(bValues[i] === '') || aValues[i].localeCompare(bValues[i]);
                        return 0;
                    });
                    const filterStates = [];
                    for (const item of items) {
                        const filterState = itemFilterStates.get(item);
                        if (!filterState)
                            continue;
                        const shouldShowItem = (0, kitsui_33.State)(false);
                        let timeUpdatedWasShowing = 0;
                        let oldShouldShow = false;
                        let wasShowing = false;
                        let wasOpen = false;
                        let timeUpdatedWasOpen = 0;
                        let forceRecheckTimeout;
                        kitsui_33.State.Use(details, { filterState, filterText, hasAnyItemFilteredIn, open: details.open, transitioning: details.transitioning }, (state, old) => {
                            clearTimeout(forceRecheckTimeout);
                            const newShouldShow = state.filterState && state.open;
                            if (wasShowing || wasOpen) {
                                if (newShouldShow !== oldShouldShow)
                                    timeUpdatedWasShowing = Date.now();
                                oldShouldShow = newShouldShow;
                                if (state.open !== wasOpen)
                                    timeUpdatedWasOpen = Date.now();
                                wasOpen = state.open;
                            }
                            if (Date.now() - timeUpdatedWasShowing < 10 || Date.now() - timeUpdatedWasOpen < 10) {
                                setTimeout(applyNewShouldShow, 10);
                                return;
                            }
                            if (state.transitioning)
                                return;
                            applyNewShouldShow();
                            function applyNewShouldShow() {
                                shouldShowItem.value = newShouldShow;
                                oldShouldShow = newShouldShow;
                                wasShowing = newShouldShow;
                                wasOpen = state.open;
                            }
                        });
                        void shouldShowItem.await(bucket, true).then(() => {
                            const itemComponent = (0, Item_2.default)(item, collections);
                            Object.assign(itemComponent, { shouldShowItem, filterState });
                            filterText.use(itemComponent, () => {
                                itemComponent.rect.markDirty();
                                Item_2.default.Tooltip?.anchor.markDirty();
                            });
                            const ownIndex = items.indexOf(item);
                            const itemComponentToPositionAfter = bucket.content.getChildren(Item_2.default).toArray().findLast(item => items.indexOf(item.item.value) < ownIndex);
                            itemComponent.insertToWhen(shouldShowItem, bucket.content, 'after', itemComponentToPositionAfter);
                        });
                        filterStates.push(shouldShowItem);
                    }
                    const shouldShowBucket = kitsui_33.State.Some(details, ...filterStates);
                    bucket.appendToWhen(shouldShowBucket, bucketsWrapper);
                };
                if (weapons.length)
                    MomentBucket()
                        .style('collections-view-moment-bucket--weapons')
                        .titleText.set(quilt => quilt['view/collections/bucket/weapons/title']())
                        .tweak(addFilteredItems, weapons);
                if (armourTitan.length)
                    MomentBucket()
                        .titleText.set(quilt => quilt['view/collections/bucket/armour/titan/title']())
                        .tweak(addFilteredItems, armourTitan);
                if (armourHunter.length)
                    MomentBucket()
                        .titleText.set(quilt => quilt['view/collections/bucket/armour/hunter/title']())
                        .tweak(addFilteredItems, armourHunter);
                if (armourWarlock.length)
                    MomentBucket()
                        .titleText.set(quilt => quilt['view/collections/bucket/armour/warlock/title']())
                        .tweak(addFilteredItems, armourWarlock);
            });
        });
    });
});
define("utility/Time", ["require", "exports", "kitsui"], function (require, exports, kitsui_34) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Time;
    (function (Time) {
        Time.state = (0, kitsui_34.State)(Date.now() / 1000);
        setInterval(() => Time.state.value = Date.now() / 1000, 100);
        function translateComponent(component, value) {
            return quilt => quilt[`shared/time/x-${component}${value === 1 ? '' : 's'}`](value);
        }
        Time.translateComponent = translateComponent;
        function translateDuration(time, maxComponents = 2) {
            const weeks = Math.floor(time / Time.weeks(1));
            const days = Math.floor((time % Time.weeks(1)) / Time.days(1));
            const hours = Math.floor((time % Time.days(1)) / Time.hours(1));
            const minutes = Math.floor((time % Time.hours(1)) / Time.minutes(1));
            const components = [];
            if (weeks)
                components.push(translateComponent('week', weeks));
            if (days && components.length < maxComponents)
                components.push(translateComponent('day', days));
            if (hours && components.length < maxComponents)
                components.push(translateComponent('hour', hours));
            if (minutes && components.length < maxComponents)
                components.push(translateComponent('minute', minutes));
            return quilt => quilt['shared/spaced'](...components.map(h => h(quilt)));
        }
        Time.translateDuration = translateDuration;
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
            if (result.endsWith(', '))
                result = result.slice(0, -2);
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
define("component/view/CollectionsView", ["require", "exports", "component/core/View", "component/DisplayBar", "component/Overlay", "component/overlay/ItemOverlay", "component/view/collections/Moment", "kitsui", "kitsui/component/Slot", "Relic", "utility/Time"], function (require, exports, View_1, DisplayBar_2, Overlay_2, ItemOverlay_1, Moment_1, kitsui_35, Slot_6, Relic_6, Time_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    View_1 = __importDefault(View_1);
    DisplayBar_2 = __importDefault(DisplayBar_2);
    Overlay_2 = __importDefault(Overlay_2);
    ItemOverlay_1 = __importDefault(ItemOverlay_1);
    Moment_1 = __importDefault(Moment_1);
    Slot_6 = __importDefault(Slot_6);
    Relic_6 = __importDefault(Relic_6);
    Time_1 = __importDefault(Time_1);
    const COLLECTIONS_DISPLAY = DisplayBar_2.default.Config({
        id: 'collections',
        sortConfig: {},
        // filterConfig: {},
    });
    const ActiveEvent = kitsui_35.State.Async(async () => {
        const conduit = await Relic_6.default.connected;
        const [DeepsightStats, DestinyEventCardDefinition] = await Promise.all([
            conduit.definitions.en.DeepsightStats.all(),
            conduit.definitions.en.DestinyEventCardDefinition.all(),
        ]);
        const event = DestinyEventCardDefinition[DeepsightStats.activeEvent];
        if (!event || (event.endTime && Date.now() > +event.endTime * 1000))
            return undefined;
        return event;
    });
    exports.default = (0, View_1.default)(async (view) => {
        view.style('collections-view')
            .style.bind(view.loading.loaded, 'collections-view--ready');
        (0, kitsui_35.Component)()
            .style('view-title')
            .viewTransitionSwipe('collections-view-title')
            .text.set(quilt => quilt['view/collections/title']())
            .appendTo(view);
        view.loading.appendTo(view);
        const { signal, setProgress } = await view.loading.start();
        setProgress(null, quilt => quilt['view/collections/load/connecting']());
        const conduit = await Relic_6.default.connected;
        if (signal.aborted)
            return;
        setProgress(null, quilt => quilt['view/collections/load/fetching']());
        const collections = (0, kitsui_35.State)(await conduit.getCollections());
        if (signal.aborted)
            return;
        await view.loading.finish();
        collections.useManual(collections => console.log('Collections:', collections));
        ////////////////////////////////////
        //#region Collections
        view.displayBarConfig.value = COLLECTIONS_DISPLAY;
        const filterText = view.displayHandlers.map(view, display => display?.filter.filterText);
        let isFirstSeason = true;
        let isFirstExpac = true;
        (0, Slot_6.default)().appendTo(view).use({ collections, ActiveEvent }, (slot, { collections, ActiveEvent }) => {
            ////////////////////////////////////
            //#region Active Event
            if (ActiveEvent) {
                const eventWrapper = (0, kitsui_35.Component)()
                    .style('collections-view-year', 'collections-view-year--event');
                const buckets = collections.moments
                    .flatMap(m => Object.entries(m.buckets))
                    .groupBy(([bucketHash]) => +bucketHash, ([, bucket]) => bucket)
                    .toObject(([bucketHash, buckets]) => [bucketHash, {
                        items: (buckets
                            .flatMap(b => b.items)
                            .filter(itemHash => collections.items[itemHash]?.sources?.some(source => source.type === 'defined' && collections.sources[source.id]?.event === ActiveEvent.hash))),
                    }]);
                const moment = collections.moments.find(m => m.moment.event === ActiveEvent.hash)
                    ?? {
                        buckets,
                        moment: {
                            hash: ActiveEvent.hash,
                            id: (ActiveEvent.displayProperties.name
                                .toLowerCase()
                                // .replace(/['"&:()-]/g, '')
                                .replace(/[^a-z]+/g, '')
                                .trim()),
                            iconWatermark: '',
                            displayProperties: ActiveEvent.displayProperties,
                            primaryImage: ActiveEvent.images.themeBackgroundImagePath,
                            images: !ActiveEvent.images.themeBackgroundImagePath ? undefined : [ActiveEvent.images.themeBackgroundImagePath],
                        },
                    };
                const momentComponent = (0, Moment_1.default)(moment, collections, view.displayHandlers).appendTo(eventWrapper);
                momentComponent.open.value = true;
                if (ActiveEvent.endTime)
                    (0, kitsui_35.Component)()
                        .style('collections-view-moment-title-time-remaining')
                        .text.bind(Time_1.default.state.map(momentComponent, time => Math.floor(time / 60)).map(momentComponent, minute => {
                        const timeRemaining = (+ActiveEvent.endTime - minute * 60) * 1000;
                        return quilt => quilt['view/collections/event-ends'](Time_1.default.translateDuration(timeRemaining)(quilt));
                    }))
                        .appendTo(momentComponent.summary);
                const shouldShow = kitsui_35.State.Map(momentComponent, [momentComponent.open, filterText], (open, filterText) => open || !filterText);
                eventWrapper.appendToWhen(shouldShow, slot);
            }
            //#endregion
            ////////////////////////////////////
            ////////////////////////////////////
            //#region Moments by Year
            let year = NaN;
            let yearWrapper;
            let yearMomentVisibilityStates = [];
            for (const moment of collections.moments) {
                if (typeof moment.moment.event === 'number' && moment.moment.event === ActiveEvent?.hash)
                    continue;
                if (moment.moment.year !== year) {
                    handleYearWrapperEnd();
                    year = moment.moment.year;
                    yearWrapper = !year ? undefined : (0, kitsui_35.Component)()
                        .style('collections-view-year')
                        .append((0, kitsui_35.Component)()
                        .style('collections-view-year-label')
                        .text.set(quilt => quilt['view/collections/year'](year)));
                }
                const momentComponent = (0, Moment_1.default)(moment, collections, view.displayHandlers);
                if (moment.moment.expansion && isFirstExpac) {
                    isFirstExpac = false;
                    momentComponent.open.value = true;
                }
                else if (moment.moment.season !== undefined && isFirstSeason) {
                    isFirstSeason = false;
                    momentComponent.open.value = true;
                }
                const shouldShow = kitsui_35.State.Map(momentComponent, [momentComponent.open, filterText], (open, filterText) => open || !filterText);
                yearMomentVisibilityStates.push(shouldShow);
                momentComponent.appendToWhen(shouldShow, yearWrapper ?? slot);
            }
            handleYearWrapperEnd();
            function handleYearWrapperEnd() {
                if (!yearWrapper)
                    return;
                const momentVisibilityStates = yearMomentVisibilityStates.slice();
                yearMomentVisibilityStates = [];
                const shouldShow = kitsui_35.State.Map(yearWrapper, momentVisibilityStates, (...states) => states.includes(true));
                yearWrapper.appendToWhen(shouldShow, slot);
            }
            //#endregion
            ////////////////////////////////////
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Item Overlay
        const itemMap = collections.mapManual((collections) => {
            const nameToHash = Object.fromEntries(collections.moments.map(moment => [moment.moment.id,
                Object.fromEntries(Object.values(moment.buckets)
                    .flatMap(bucket => bucket.items)
                    .map(hash => {
                    const item = collections.items[hash];
                    const itemRefName = item.displayProperties.name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, ' ')
                        .trim()
                        .replaceAll(' ', '-');
                    item.refNames = { moment: moment.moment.id, item: itemRefName };
                    return [itemRefName, item.hash];
                })),
            ]));
            const hashToName = Object.fromEntries(Object.entries(nameToHash)
                .flatMap(([momentName, momentMap]) => (Object.entries(momentMap)
                .map(([itemName, itemHash]) => [
                itemHash,
                { moment: momentName, item: itemName },
            ]))));
            return { nameToHash, hashToName };
        });
        const overlayItem = kitsui_35.State.Map(view, [view.params, collections, itemMap], (params, collections, itemMap) => {
            if (!params)
                return undefined;
            const result = 'itemHash' in params
                ? collections.items[+params.itemHash] ?? undefined
                : 'itemName' in params
                    ? collections.items[itemMap.nameToHash[params.moment]?.[params.itemName]] ?? undefined
                    : undefined;
            if (result !== undefined) {
                view.loading.skipViewTransition();
                return result;
            }
        });
        (0, Overlay_2.default)(view).bind(overlayItem.truthy).and(ItemOverlay_1.default, overlayItem, collections);
        //#endregion
        ////////////////////////////////////
    });
});
define("component/core/Paginator", ["require", "exports", "component/core/Button", "component/core/DisplaySlot", "kitsui", "kitsui/component/Loading"], function (require, exports, Button_5, DisplaySlot_4, kitsui_36, Loading_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_5 = __importDefault(Button_5);
    DisplaySlot_4 = __importDefault(DisplaySlot_4);
    Loading_2 = __importDefault(Loading_2);
    const Paginator = (0, kitsui_36.Component)((component) => {
        const state = (0, kitsui_36.State)(undefined);
        const currentPage = (0, kitsui_36.State)(-1);
        const totalPages = (0, kitsui_36.State)(0);
        const isLastPage = kitsui_36.State.MapManual([currentPage, totalPages], (page, total) => page >= total - 1);
        const lastDirection = (0, kitsui_36.State)(1);
        const pageData = [];
        const pages = [];
        const hasPageData = (0, kitsui_36.State)(false);
        const loading = (0, kitsui_36.State)(false);
        const shouldDisplay = kitsui_36.State.MapManual([hasPageData, totalPages], (hasPageData, totalPages) => hasPageData && totalPages >= 1);
        (0, Loading_2.default)()
            .style('paginator-loading')
            .showForever()
            .appendToWhen(loading, component);
        const Page = (0, kitsui_36.Component)((pageComponent, page) => {
            pageData[page] ??= (0, kitsui_36.State)(undefined);
            return pageComponent.style('paginator-page')
                .and(DisplaySlot_4.default)
                .use(pageData[page], (slot, data) => {
                if (data === undefined)
                    return;
                hasPageData.value = true;
                loading.value = false;
                state.value?.init(component, slot, page, data);
            });
        });
        (0, Button_5.default)()
            .style('paginator-button', 'paginator-button-prev')
            .append((0, kitsui_36.Component)()
            .style('paginator-button-arrow', 'paginator-button-prev-arrow'))
            .bindDisabled(currentPage.equals(0), 'no previous pages')
            .event.subscribe('click', () => currentPage.value = Math.max(0, currentPage.value - 1))
            .appendToWhen(shouldDisplay, component);
        const pageContainer = (0, kitsui_36.Component)()
            .style('paginator-page-container')
            .style.bindVariable('direction', lastDirection)
            .appendToWhen(shouldDisplay, component);
        currentPage.subscribeManual((page, lastPage) => {
            if (!state.value)
                return;
            lastDirection.value = page > (lastPage ?? -1) ? 1 : -1;
            pageData[page] ??= kitsui_36.State.Async(component, async () => {
                if (!hasPageData.value)
                    loading.value = true;
                return await state.value?.get(page);
            });
            pages[page] ??= Page(page)
                .style.bind(currentPage.equals(page), 'paginator-page--active')
                .appendTo(pageContainer);
        });
        (0, Button_5.default)()
            .style('paginator-button', 'paginator-button-next')
            .append((0, kitsui_36.Component)()
            .style('paginator-button-arrow', 'paginator-button-next-arrow'))
            .bindDisabled(isLastPage, 'no more pages')
            .event.subscribe('click', () => currentPage.value = Math.min(totalPages.value - 1, currentPage.value + 1))
            .appendToWhen(shouldDisplay, component);
        (0, DisplaySlot_4.default)()
            .style('paginator-display')
            .use(totalPages, (slot, totalPages) => {
            for (let i = 0; i < totalPages; i++) {
                (0, kitsui_36.Component)()
                    .style('paginator-display-page')
                    .tweak(pageDot => pageDot
                    .style.bindVariable('distance', currentPage.map(pageDot, page => Math.abs(page - i)))
                    .style.bind(currentPage.equals(i), 'paginator-display-page--active'))
                    .appendTo(slot);
            }
        })
            .appendToWhen(shouldDisplay, component);
        return component.style('paginator')
            .extend(component => ({
            config(definition) {
                pageContainer.removeContents();
                pageData.length = 0;
                pages.length = 0;
                state.value = definition;
                totalPages.value = 1;
                currentPage.value = 0;
                hasPageData.value = false;
                return component;
            },
            getTotalPages() {
                return totalPages.value;
            },
            setTotalPages(pages) {
                totalPages.value = pages;
                return component;
            },
        }));
    });
    exports.default = Paginator;
});
define("component/core/TabButton", ["require", "exports", "component/core/Button", "kitsui"], function (require, exports, Button_6, kitsui_37) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_6 = __importDefault(Button_6);
    exports.default = (0, kitsui_37.Component)((component, active) => {
        return component.and(Button_6.default).style('tab-button')
            .style.bind(active, 'tab-button--active')
            .tweak(button => button
            .style.bind(button.hoveredOrHasFocused, 'button--hover', 'tab-button--hover'))
            .append((0, kitsui_37.Component)()
            .style('tab-button-underline')
            .style.bind(active, 'tab-button-underline--active'));
    });
});
define("component/core/Tabinator", ["require", "exports", "component/core/Link", "component/core/TabButton", "kitsui"], function (require, exports, Link_2, TabButton_1, kitsui_38) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Link_2 = __importDefault(Link_2);
    TabButton_1 = __importDefault(TabButton_1);
    const Tabinator = (0, kitsui_38.Component)((component) => {
        const header = (0, kitsui_38.Component)()
            .style('tabinator-header')
            .appendTo(component);
        const content = (0, kitsui_38.Component)()
            .style('tabinator-content')
            .appendTo(component);
        let watchingNavigation = false;
        const tabinatorId = Math.random().toString(36).slice(2);
        const tabinatorDirection = (0, kitsui_38.State)(-1);
        const defaultSelection = (0, kitsui_38.State)(undefined);
        const currentURL = (0, kitsui_38.State)(undefined);
        const Tab = (0, kitsui_38.Component)((component, route) => {
            if ([...header.getChildren(Tab)].every(tab => !tab.selected.value))
                defaultSelection.value ??= component;
            const selected = (0, kitsui_38.State)(false);
            const isDefaultSelection = defaultSelection.equals(component);
            selected.bind(component, isDefaultSelection);
            if (route) {
                watchNavigation();
                kitsui_38.State.Use(component, { currentURL, route: kitsui_38.State.get(route) }, ({ currentURL, route }) => {
                    if (currentURL === route)
                        selectTab(component);
                });
            }
            const tabId = Math.random().toString(36).slice(2);
            const tabContent = (0, kitsui_38.Component)()
                .style('tabinator-tab-content')
                .style.bind(selected.falsy, 'tabinator-tab-content--hidden')
                .ariaRole('tabpanel')
                .setId(`tabinator-${tabinatorId}-content-${tabId}`)
                .attributes.bind(selected.falsy, 'inert')
                .appendTo(content);
            if (route)
                component = component.and(Link_2.default, route)
                    .tweak(link => link.overrideClick.value = false);
            const enabled = (0, kitsui_38.State)(true);
            return component
                .and(TabButton_1.default, selected)
                .bindDisabled(enabled.falsy, 'bindEnabled')
                .tweak(b => b.style.bind(b.disabled, 'button--disabled', 'tabinator-tab-button--disabled'))
                .ariaRole('tab')
                .setId(`tabinator-${tabinatorId}-tab-${tabId}`)
                .attributes.bind('aria-selected', selected.mapManual(isSelected => isSelected ? 'true' : 'false'))
                .ariaControls(tabContent)
                .extend(tab => ({
                selected,
                content: tabContent.ariaLabelledBy(tab),
                bindEnabled(state) {
                    if (state)
                        enabled.bind(tab, state);
                    else
                        enabled.value = true;
                    return tab;
                },
                setDefaultSelection() {
                    defaultSelection.value = tab;
                    return tab;
                },
                select() {
                    selectTab(tab);
                },
            }))
                .onRooted(tab => {
                tab.event.subscribe('click', e => {
                    e.preventDefault();
                    selectTab(tab);
                    if (tab.is(Link_2.default))
                        navigate.setURL(tab.href.value);
                });
            })
                .appendTo(header);
        });
        return component
            .style('tabinator')
            .style.bindVariable('tabinator-direction', tabinatorDirection)
            .extend(tabinator => ({
            Tab,
        }));
        function watchNavigation() {
            if (watchingNavigation)
                return;
            watchingNavigation = true;
            currentURL.bind(component, navigate.state.delay(component, 10).map(component, url => new URL(url).pathname));
        }
        function selectTab(newSelectedTab) {
            let previousSelectedTabIndex = Infinity;
            let newSelectedTabIndex = -1;
            const tabs = [...header.getChildren(Tab)];
            for (let i = 0; i < tabs.length; i++) {
                const tab = tabs[i];
                if (tab === newSelectedTab) {
                    newSelectedTabIndex = i;
                    continue;
                }
                if (tab.selected.value)
                    previousSelectedTabIndex = Math.min(previousSelectedTabIndex, i);
                tab.selected.asMutable?.setValue(false);
            }
            tabinatorDirection.value = (Math.sign(newSelectedTabIndex - previousSelectedTabIndex) || -1);
            newSelectedTab.selected.asMutable?.setValue(true);
            defaultSelection.value = undefined;
        }
    });
    exports.default = Tabinator;
});
define("component/view/data/DataComponentHelper", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function DataComponentHelper(helper) {
        return helper;
    }
    exports.default = DataComponentHelper;
});
define("component/view/data/component/ClarityDescriptions", ["require", "exports", "component/view/data/DataComponentHelper"], function (require, exports, DataComponentHelper_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    DataComponentHelper_1 = __importDefault(DataComponentHelper_1);
    exports.default = (0, DataComponentHelper_1.default)({
        getName(definition) {
            return definition.name;
        },
        getSubtitle(definition) {
            return definition.type;
        },
    });
});
define("component/view/data/component/DestinyInventoryItemDefinition", ["require", "exports", "component/view/data/DataComponentHelper"], function (require, exports, DataComponentHelper_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    DataComponentHelper_2 = __importDefault(DataComponentHelper_2);
    exports.default = (0, DataComponentHelper_2.default)({
        getSubtitle(definition) {
            return definition.itemTypeAndTierDisplayName;
        },
    });
});
define("component/view/data/DataHelperRegistry", ["require", "exports", "component/view/data/component/ClarityDescriptions", "component/view/data/component/DestinyInventoryItemDefinition"], function (require, exports, ClarityDescriptions_1, DestinyInventoryItemDefinition_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    ClarityDescriptions_1 = __importDefault(ClarityDescriptions_1);
    DestinyInventoryItemDefinition_1 = __importDefault(DestinyInventoryItemDefinition_1);
    exports.default = {
        DestinyInventoryItemDefinition: DestinyInventoryItemDefinition_1.default,
        ClarityDescriptions: ClarityDescriptions_1.default,
    };
});
define("component/view/data/DataHelper", ["require", "exports", "component/view/data/DataHelperRegistry", "utility/Objects"], function (require, exports, DataHelperRegistry_1, Objects_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    DataHelperRegistry_1 = __importDefault(DataHelperRegistry_1);
    var DataHelper;
    (function (DataHelper) {
        DataHelper.FALLBACK_ICON = 'https://www.bungie.net/img/destiny_content/collections/undiscovered.png';
        const MISSING_ICON = 'https://www.bungie.net/img/misc/missing_icon_d2.png';
        function getComponentName(component, short) {
            const result = component
                ?.replace(/([A-Z])/g, ' $1')
                .trimStart()
                .replace(' ', ': ')
                .replace('Definition', '');
            return short ? result?.split(': ')[1] : result;
        }
        DataHelper.getComponentName = getComponentName;
        function display(definition) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return definition?.['displayProperties'];
        }
        DataHelper.display = display;
        function get(component) {
            return component ? DataHelperRegistry_1.default[component] : undefined;
        }
        DataHelper.get = get;
        function getIcon(component, definition) {
            if (definition) {
                const icon = Objects_2._
                    ?? get(component)?.getIcon?.(definition)
                    ?? display(definition)?.icon;
                if (icon && MISSING_ICON.endsWith(icon))
                    return DataHelper.FALLBACK_ICON;
                if (icon && icon.startsWith('/'))
                    return `https://www.bungie.net${icon}`;
                if (icon && icon.startsWith('./'))
                    return `https://deepsight.gg${icon.slice(1)}`;
            }
            return DataHelper.FALLBACK_ICON;
        }
        DataHelper.getIcon = getIcon;
        function getTitle(component, definition) {
            return Objects_2._
                || get(component)?.getName?.(definition)
                || display(definition)?.name
                || 'No name';
        }
        DataHelper.getTitle = getTitle;
        function getSubtitle(component, definition) {
            return Objects_2._
                || get(component)?.getSubtitle?.(definition)
                || display(definition)?.subtitle
                || getComponentName(component);
        }
        DataHelper.getSubtitle = getSubtitle;
    })(DataHelper || (DataHelper = {}));
    exports.default = DataHelper;
});
define("component/view/data/DataDefinitionButton", ["require", "exports", "component/core/Button", "component/core/Image", "component/view/data/DataHelper", "kitsui"], function (require, exports, Button_7, Image_8, DataHelper_1, kitsui_39) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_7 = __importDefault(Button_7);
    Image_8 = __importDefault(Image_8);
    DataHelper_1 = __importDefault(DataHelper_1);
    const DataDefinitionButton = (0, kitsui_39.Component)('a', (component) => component
        .and(Button_7.default)
        .style('data-view-definition-button')
        .extend(component => ({
        data: (0, kitsui_39.State)(undefined),
    }))
        .event.subscribe('click', e => e.preventDefault())
        .event.subscribe('contextmenu', e => {
        e.preventDefault();
        const url = e.host.attributes.get('href')?.value;
        if (url)
            void navigate.toURL(url);
        return false;
    })
        .tweak(button => {
        button.textWrapper.remove();
        button.attributes.bind('href', button.data.mapManual(data => !data || !('hash' in data.definition)
            ? undefined
            : `/data/${data.component}/${String(data.definition.hash)}`));
        const icon = button.data.mapManual(data => DataHelper_1.default.getIcon(data?.component, data?.definition));
        const title = button.data.mapManual(data => DataHelper_1.default.getTitle(data?.component, data?.definition));
        const subtitle = button.data.mapManual(data => DataHelper_1.default.getSubtitle(data?.component, data?.definition));
        (0, Image_8.default)(icon, DataHelper_1.default.FALLBACK_ICON)
            .style('data-view-definition-button-icon')
            .appendTo(button);
        (0, kitsui_39.Component)()
            .style('data-view-definition-button-title')
            .text.bind(title)
            .appendTo(button);
        (0, kitsui_39.Component)()
            .style('data-view-definition-button-subtitle')
            .text.bind(subtitle)
            .appendTo(button);
    }));
    exports.default = DataDefinitionButton;
});
define("utility/Define", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function Define(proto, key, implementation) {
        try {
            Object.defineProperty(proto, key, {
                configurable: true,
                writable: true,
                value: implementation,
            });
        }
        catch { }
    }
    (function (Define) {
        function all(protos, key, implementation) {
            for (const proto of protos) {
                Define(proto, key, implementation);
            }
        }
        Define.all = all;
        function magic(obj, key, implementation) {
            try {
                Object.defineProperty(obj, key, {
                    configurable: true,
                    ...implementation,
                });
            }
            catch { }
        }
        Define.magic = magic;
        function set(obj, key, value) {
            try {
                Object.defineProperty(obj, key, {
                    configurable: true,
                    writable: true,
                    value,
                });
            }
            catch { }
            return value;
        }
        Define.set = set;
    })(Define || (Define = {}));
    exports.default = Define;
});
define("utility/Arrays", ["require", "exports", "utility/Define"], function (require, exports, Define_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Define_1 = __importDefault(Define_1);
    var Arrays;
    (function (Arrays) {
        function applyPrototypes() {
            (0, Define_1.default)(Array.prototype, 'findLast', function (predicate) {
                if (this.length > 0)
                    for (let i = this.length - 1; i >= 0; i--)
                        if (predicate(this[i], i, this))
                            return this[i];
                return undefined;
            });
            (0, Define_1.default)(Array.prototype, 'findLastIndex', function (predicate) {
                if (this.length > 0)
                    for (let i = this.length - 1; i >= 0; i--)
                        if (predicate(this[i], i, this))
                            return i;
                return -1;
            });
            const originalSort = Array.prototype.sort;
            (0, Define_1.default)(Array.prototype, 'sort', function (...sorters) {
                if (this.length <= 1)
                    return this;
                if (!sorters.length)
                    return originalSort.call(this);
                return originalSort.call(this, (a, b) => {
                    for (const sorter of sorters) {
                        if (!sorter)
                            continue;
                        if (sorter.length === 1) {
                            const mapper = sorter;
                            const sortValue = mapper(b) - mapper(a);
                            if (sortValue)
                                return sortValue;
                        }
                        else {
                            const sortValue = sorter(a, b);
                            if (sortValue)
                                return sortValue;
                        }
                    }
                    return 0;
                });
            });
            (0, Define_1.default)(Array.prototype, 'collect', function (collector, ...args) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                return collector?.(this, ...args);
            });
            (0, Define_1.default)(Array.prototype, 'splat', function (collector, ...args) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                return collector?.(...this, ...args);
            });
            (0, Define_1.default)(Array.prototype, 'toObject', function (mapper) {
                return Object.fromEntries(mapper ? this.map(mapper) : this);
            });
            (0, Define_1.default)(Array.prototype, 'toMap', function (mapper) {
                return new Map(mapper ? this.map(mapper) : this);
            });
            (0, Define_1.default)(Array.prototype, 'toSet', function () {
                return new Set(this);
            });
            (0, Define_1.default)(Array.prototype, 'distinct', function (mapper) {
                const result = [];
                const encountered = mapper ? [] : result;
                for (const value of this) {
                    const encounterValue = mapper ? mapper(value) : value;
                    if (encountered.includes(encounterValue))
                        continue;
                    if (mapper)
                        encountered.push(encounterValue);
                    result.push(value);
                }
                return result;
            });
            (0, Define_1.default)(Array.prototype, 'findMap', function (predicate, mapper) {
                for (let i = 0; i < this.length; i++)
                    if (predicate(this[i], i, this))
                        return mapper(this[i], i, this);
                return undefined;
            });
            (0, Define_1.default)(Array.prototype, 'groupBy', function (grouper, mapper) {
                const result = {};
                for (let i = 0; i < this.length; i++)
                    (result[String(grouper(this[i], i, this))] ??= []).push(!mapper ? this[i] : mapper(this[i], i, this));
                return Object.entries(result);
            });
        }
        Arrays.applyPrototypes = applyPrototypes;
        Arrays.EMPTY = [];
        function resolve(or) {
            return Array.isArray(or) ? or : or === undefined ? [] : [or];
        }
        Arrays.resolve = resolve;
        function includes(array, value) {
            return Array.isArray(array) ? array.includes(value) : array === value;
        }
        Arrays.includes = includes;
        function slice(or) {
            return Array.isArray(or) ? or.slice() : or === undefined ? [] : [or];
        }
        Arrays.slice = slice;
        /**
         * Removes one instance of the given value from the given array.
         * @returns `true` if removed, `false` otherwise
         */
        function remove(array, ...values) {
            if (!array)
                return false;
            let removed = false;
            for (const value of values) {
                const index = array.indexOf(value);
                if (index === -1)
                    continue;
                array.splice(index, 1);
                removed = true;
            }
            return removed;
        }
        Arrays.remove = remove;
        /**
         * Removes one instance of the given value from the given array.
         * @returns `true` if removed, `false` otherwise
         */
        function removeSwap(array, ...values) {
            if (!array)
                return false;
            let removed = false;
            for (const value of values) {
                const index = array.indexOf(value);
                if (index === -1)
                    continue;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const swap = array.pop();
                if (!array.length)
                    break;
                if (index !== array.length)
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    array[index] = swap;
                removed = true;
            }
            return removed;
        }
        Arrays.removeSwap = removeSwap;
        /**
         * Adds the given value to the given array if not present.
         * @returns `true` if added, `false` otherwise
         */
        function add(array, value) {
            if (!array)
                return false;
            const index = array.indexOf(value);
            if (index !== -1)
                return false;
            array.push(value);
            return true;
        }
        Arrays.add = add;
        function tuple(...values) {
            return values;
        }
        Arrays.tuple = tuple;
        function range(start, end, step) {
            if (step === 0)
                throw new Error('Invalid step for range');
            const result = [];
            if (end === undefined)
                end = start, start = 0;
            step = end < start ? -1 : 1;
            for (let i = start; step > 0 ? i < end : i > end; i += step)
                result.push(i);
            return result;
        }
        Arrays.range = range;
        function filterNullish(value) {
            return value !== null && value !== undefined;
        }
        Arrays.filterNullish = filterNullish;
        function filterFalsy(value) {
            return !!value;
        }
        Arrays.filterFalsy = filterFalsy;
        function mergeSorted(...arrays) {
            return arrays.reduce((prev, curr) => mergeSorted2(prev, curr), []);
        }
        Arrays.mergeSorted = mergeSorted;
        function mergeSorted2(array1, array2) {
            const merged = [];
            let index1 = 0;
            let index2 = 0;
            while (index1 < array1.length || index2 < array2.length) {
                const v1 = index1 < array1.length ? array1[index1] : undefined;
                const v2 = index2 < array2.length ? array2[index2] : undefined;
                if (v1 === v2) {
                    merged.push(v1);
                    index1++;
                    index2++;
                    continue;
                }
                if (v1 === undefined && v2 !== undefined) {
                    merged.push(v2);
                    index2++;
                    continue;
                }
                if (v2 === undefined && v1 !== undefined) {
                    merged.push(v1);
                    index1++;
                    continue;
                }
                const indexOfPerson1InList2 = array2.indexOf(v1, index2);
                if (indexOfPerson1InList2 === -1) {
                    merged.push(v1);
                    index1++;
                }
                else {
                    merged.push(v2);
                    index2++;
                }
            }
            return merged;
        }
    })(Arrays || (Arrays = {}));
    exports.default = Arrays;
});
define("component/view/data/DataProvider", ["require", "exports", "kitsui", "Relic", "utility/Arrays", "utility/Objects"], function (require, exports, kitsui_40, Relic_7, Arrays_4, Objects_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Relic_7 = __importDefault(Relic_7);
    Arrays_4 = __importDefault(Arrays_4);
    function DataProvider(definition) {
        const cachedData = [];
        const prepCache = [];
        function getInternal(...params) {
            return {
                params,
                data: kitsui_40.State.Async(kitsui_40.State.Owner.create(), async (signal, setProgress) => {
                    return await definition.provider(params, signal, setProgress);
                }),
            };
        }
        const equals = definition.equals ?? ((a, b) => {
            if (a.length !== b.length)
                return false;
            return a.every((param, index) => param === b[index]);
        });
        return {
            prep(...params) {
                let cached = Objects_3._
                    ?? cachedData.find(item => equals(item.params, params))
                    ?? prepCache.find(item => equals(item.params, params));
                if (cached)
                    return;
                cached = getInternal(...params);
                prepCache.push(cached);
                if (prepCache.length > 200)
                    prepCache.shift();
            },
            get(...params) {
                let cached = cachedData.find(item => equals(item.params, params));
                if (cached)
                    return cached.data;
                const prepCacheIndex = prepCache.findIndex(item => equals(item.params, params));
                if (prepCacheIndex !== -1) {
                    cached = prepCache[prepCacheIndex];
                    // Move from prepCache to cachedData
                    prepCache.splice(prepCacheIndex, 1);
                    cachedData.push(cached);
                    return cached.data;
                }
                cached = getInternal(...params);
                cachedData.push(cached);
                if (cachedData.length > 20)
                    cachedData.shift();
                return cached.data;
            },
        };
    }
    (function (DataProvider) {
        DataProvider.SINGLE = DataProvider({
            provider: async ([component, hash], signal, setProgress) => {
                const conduit = await Relic_7.default.connected;
                if (signal.aborted)
                    return undefined;
                const result = await conduit.definitions.en[component].getWithLinks(hash);
                if (!result || signal.aborted)
                    return undefined;
                return result;
            },
            cacheSize: 20,
            prepCacheSize: 200,
            equals: ([aComponent, aHash], [bComponent, bHash]) => {
                return aComponent === bComponent && `${aHash}` === `${bHash}`;
            },
        });
        DataProvider.createPaged = (filters) => {
            const filtersObj = typeof filters === 'string' ? createDefinitionsFilter(filters) : filters;
            return DataProvider({
                provider: async ([component, pageSize, page], signal, setProgress) => {
                    const conduit = await Relic_7.default.connected;
                    if (signal.aborted)
                        return undefined;
                    const definitionsPage = await conduit.definitions.en[component].page(pageSize, page, filtersObj);
                    if (signal.aborted)
                        return undefined;
                    return definitionsPage;
                },
                cacheSize: 5,
                prepCacheSize: 5,
            });
        };
        DataProvider.createReferencesPaged = (component, hash) => {
            return DataProvider({
                provider: async ([pageSize, page], signal, setProgress) => {
                    const conduit = await Relic_7.default.connected;
                    if (signal.aborted)
                        return undefined;
                    return await conduit.definitions.en[component].getReferencing(hash, pageSize, page);
                },
                cacheSize: 5,
                prepCacheSize: 5,
            });
        };
        function createDefinitionsFilter(filterText) {
            if (!filterText)
                return undefined;
            filterText = filterText.replace(/\s+/g, ' ').trim();
            let inQuotes = false;
            let tokens = [''];
            for (let i = 0; i < filterText.length; i++) {
                const char = filterText[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                    continue;
                }
                if (char === ' ' && !inQuotes) {
                    tokens.push('');
                    continue;
                }
                tokens[tokens.length - 1] += char;
            }
            const filter = {};
            tokens = tokens.filter(token => token.length > 3);
            for (const token of tokens) {
                if (token.startsWith('deep:')) {
                    Arrays_4.default.resolve(filter.deepContains ??= []).push(token.substring(5));
                    continue;
                }
                if (token.startsWith('$')) {
                    Arrays_4.default.resolve(filter.jsonPathExpression ??= []).push(token);
                    continue;
                }
                Arrays_4.default.resolve(filter.nameContainsOrHashIs ??= []).push(token);
            }
            return filter;
        }
        DataProvider.createDefinitionsFilter = createDefinitionsFilter;
    })(DataProvider || (DataProvider = {}));
    exports.default = DataProvider;
});
define("component/overlay/DataOverlay", ["require", "exports", "component/core/Details", "component/core/Link", "component/core/Paginator", "component/core/Tabinator", "component/view/data/DataDefinitionButton", "component/view/data/DataHelper", "component/view/data/DataProvider", "kitsui", "kitsui/component/Loading", "kitsui/component/Slot", "kitsui/utility/InputBus", "kitsui/utility/Task", "utility/Arrays"], function (require, exports, Details_2, Link_3, Paginator_1, Tabinator_1, DataDefinitionButton_1, DataHelper_2, DataProvider_1, kitsui_41, Loading_3, Slot_7, InputBus_3, Task_4, Arrays_5) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Details_2 = __importDefault(Details_2);
    Link_3 = __importDefault(Link_3);
    Paginator_1 = __importDefault(Paginator_1);
    Tabinator_1 = __importDefault(Tabinator_1);
    DataDefinitionButton_1 = __importDefault(DataDefinitionButton_1);
    DataHelper_2 = __importDefault(DataHelper_2);
    DataProvider_1 = __importDefault(DataProvider_1);
    Loading_3 = __importDefault(Loading_3);
    Slot_7 = __importDefault(Slot_7);
    InputBus_3 = __importDefault(InputBus_3);
    Task_4 = __importDefault(Task_4);
    Arrays_5 = __importDefault(Arrays_5);
    exports.default = (0, kitsui_41.Component)((component, params) => {
        component.style('data-overlay');
        const dedupedParams = params.delay(component, 10, params => params, (a, b) => true
            && a?.table === b?.table
            && a?.hash === b?.hash
            && a?.definition === b?.definition
            && a?.links === b?.links);
        const links = dedupedParams.map(component, params => {
            const links = params?.links;
            if (!links)
                return undefined;
            return {
                ...links,
                links: links?.links?.map(link => ({
                    link,
                    pathRegex: new RegExp(`^${(link.path
                        .replaceAll('.', '\\.')
                        .replaceAll('[]', '\\d+')
                        .replaceAll('{}', '[^\\.]+'))}$`),
                })),
            };
        });
        ////////////////////////////////////
        //#region JSON
        const JSONComponent = kitsui_41.Component.Tag();
        const JSONPunctuation = (0, kitsui_41.Component)((component, punctuationString) => component.and(JSONComponent)
            .style('data-overlay-json-punctuation')
            .text.set(punctuationString));
        const JSONPlaceholder = (0, kitsui_41.Component)((component, text) => component.and(JSONComponent)
            .style('data-overlay-json-placeholder')
            .text.set(text));
        ////////////////////////////////////
        //#region Copypaste
        const JSONCopyPaste = (0, kitsui_41.Component)('input', (component, value) => component.and(JSONComponent)
            .replaceElement('input')
            .style('data-overlay-json-copypaste')
            .attributes.set('readonly', 'true')
            .tweak(input => {
            const string = `${value}`;
            input.element.value = string;
            input.style.setVariable('chars', string.length);
        })
            .event.subscribe('mousedown', e => {
            const input = e.host;
            if (document.activeElement !== input.element) {
                void Task_4.default.yield().then(() => input.element.select());
            }
        })
            .event.subscribe('blur', e => {
            window.getSelection()?.removeAllRanges();
        }));
        const JSONContainer = (0, kitsui_41.Component)((component, key, value, path, hold) => {
            const pathString = path.join('/');
            const highlighted = navigate.hash.equals(`#${pathString}`);
            let container;
            const keyComponent = (0, kitsui_41.Component)('a')
                .style('data-overlay-json-container-key')
                .attributes.set('href', `#${pathString}`)
                .append(...typeof key === 'object' ? Arrays_5.default.resolve(key) : [])
                .text.append(typeof key !== 'object' ? `${key}` : '')
                .event.subscribe('click', e => {
                if (e.targetComponent?.is(JSONCopyPaste))
                    return;
                e.preventDefault();
                container.open.value = !container.open.value;
            });
            hold ??= (0, kitsui_41.State)(false);
            let hasInit = false;
            return container = component.and(Details_2.default).and(JSONComponent)
                .style('data-overlay-json-container-entry')
                .tweak(details => hold.use(details, hold => {
                if (hold)
                    return;
                if (hasInit)
                    return;
                hasInit = true;
                const valueComponent = JSONValue(value, path, details.open.falsy);
                const expandable = valueComponent.as(JSONObject) ?? valueComponent.as(JSONArray);
                details.summary
                    .style('data-overlay-json-container-entry-summary')
                    .style.toggle(!expandable, 'data-overlay-json-container-entry-summary--simple')
                    .append(keyComponent)
                    .append(JSONPunctuation(':'))
                    .text.append(' ')
                    .append(expandable ? undefined : valueComponent)
                    .append(!expandable ? undefined : (expandable.is(JSONObject)
                    ? JSONPlaceholder(`{} ${expandable.size} ${expandable.size === 1 ? 'entry' : 'entries'}`)
                    : JSONPlaceholder(`[] ${expandable.length} ${expandable.length === 1 ? 'item' : 'items'}`)))
                    .event.subscribe('click', e => {
                    if (e.targetComponent?.is(JSONCopyPaste))
                        e.preventDefault();
                });
                details.content
                    .append((0, kitsui_41.Component)()
                    .style('data-overlay-json-container-expandable')
                    .append(expandable));
            }))
                .onRooted(() => {
                highlighted.use(keyComponent, highlighted => {
                    if (!highlighted)
                        return;
                    const jsonRoot = container.getAncestorComponents(JSONComponent).toArray().at(-1);
                    for (const container of jsonRoot?.getDescendants(JSONContainer) ?? []) {
                        container.open.value = false;
                        container.key.style.remove('data-overlay-json-container-key--highlighted');
                    }
                    container.key.style('data-overlay-json-container-key--highlighted');
                    container.open.value = true;
                    for (const ancestorContainer of container.getAncestorComponents(JSONContainer)) {
                        ancestorContainer.key.style('data-overlay-json-container-key--highlighted');
                        ancestorContainer.open.value = true;
                    }
                });
            })
                .extend(container => ({
                key: keyComponent,
                path,
            }));
        });
        const JSONObject = (0, kitsui_41.Component)((component, object, path, hold) => {
            component.style('data-overlay-json', 'data-overlay-json-object');
            const entries = Object.entries(object);
            for (const [key, value] of entries) {
                JSONContainer(key, value, [...path ?? [], key], hold)
                    .tweak(container => container.key.style('data-overlay-json-object-key'))
                    .appendTo(component);
            }
            return component.and(JSONComponent).extend(obj => ({
                size: entries.length,
            }));
        });
        const JSONArray = (0, kitsui_41.Component)((component, array, path, hold) => {
            component.style('data-overlay-json', 'data-overlay-json-array');
            for (let i = 0; i < array.length; i++) {
                JSONContainer([JSONPunctuation('['), JSONNumber(i), JSONPunctuation(']')], array[i], [...path ?? [], i], hold)
                    .tweak(container => container.key.style('data-overlay-json-array-index'))
                    .appendTo(component);
            }
            return component.and(JSONComponent).extend(arr => ({
                length: array.length,
            }));
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Literals
        const JSONString = (0, kitsui_41.Component)((component, string, path) => component.and(JSONComponent)
            .style('data-overlay-json', 'data-overlay-json-string')
            .append(JSONPunctuation('"'))
            .append(string && JSONCopyPaste(string).style('data-overlay-json-string-value'))
            .append(JSONPunctuation('"')));
        const JSONNumber = (0, kitsui_41.Component)((component, number, path) => component.and(JSONComponent)
            .style('data-overlay-json', 'data-overlay-json-number')
            .append(JSONCopyPaste(number))
            .append((0, Slot_7.default)().use(links, (slot, links) => {
            if (!links)
                return;
            const pathString = path?.join('.') ?? '';
            const { link } = links.links?.find(({ pathRegex }) => pathRegex.test(pathString)) ?? {};
            if (!link)
                return;
            const ref = (0, kitsui_41.Component)()
                .style('data-overlay-json-reference')
                .appendTo(slot);
            if ('enum' in link) {
                const enumDef = links.enums?.[link.enum];
                ////////////////////////////////////
                //#region Reference Enum
                const enumMember = enumDef?.members.find(e => e.value === number);
                if (enumDef && enumMember)
                    ref
                        .style('data-overlay-json-reference-enum')
                        .append(JSONPunctuation('enum'))
                        .text.append(' ')
                        .append((0, kitsui_41.Component)()
                        .style('data-overlay-json-reference-enum-name')
                        .text.set(enumDef.name))
                        .append(JSONPunctuation('.'))
                        .append((0, kitsui_41.Component)()
                        .style('data-overlay-json-reference-enum-member')
                        .text.set(enumMember.name));
                //#endregion
                ////////////////////////////////////
                else if (enumDef?.bitmask) {
                    ////////////////////////////////////
                    //#region Reference Bitmask
                    const enumMembers = number === 0
                        ? enumDef.members.filter(e => e.value === 0)
                        : enumDef.members.filter(e => (e.value & number) === e.value && e.value !== 0);
                    if (enumMembers.length > 0)
                        ref
                            .style('data-overlay-json-reference-enum')
                            .append(JSONPunctuation('bitmask'))
                            .text.append(' ')
                            .append((0, kitsui_41.Component)()
                            .style('data-overlay-json-reference-enum-name')
                            .text.set(enumDef.name))
                            .text.append(' ')
                            .append(JSONPunctuation('['))
                            .text.append(' ')
                            .append(...enumMembers.flatMap((e, i) => [
                            i && JSONPunctuation(' | '),
                            ((0, kitsui_41.Component)()
                                .style('data-overlay-json-reference-enum-member')
                                .text.set(e.name)),
                        ]))
                            .text.append(' ')
                            .append(JSONPunctuation(']'));
                    //#endregion
                    ////////////////////////////////////
                }
            }
            else {
                ////////////////////////////////////
                //#region Reference Def
                const defs = links.definitions?.[link.component];
                const linkedDef = defs?.[number];
                DataProvider_1.default.SINGLE.prep(link.component, number);
                if (linkedDef)
                    ref
                        .style('data-overlay-json-reference-definition')
                        .append((0, Link_3.default)(`/data/${link.component}/${number}`)
                        .style('data-overlay-json-reference-definition-link')
                        .append((0, kitsui_41.Component)()
                        .style('data-overlay-json-reference-label')
                        .text.set(DataHelper_2.default.getComponentName(link.component)))
                        .text.append(' "')
                        .append((0, kitsui_41.Component)()
                        .style('data-overlay-json-reference-definition-link-title')
                        .text.set(DataHelper_2.default.getTitle(link.component, linkedDef)))
                        .text.append('"'));
                //#endregion
                ////////////////////////////////////
            }
            if (ref.element.childNodes.length)
                slot.prepend(JSONPunctuation(' // '));
        })));
        const JSONBool = (0, kitsui_41.Component)((component, bool) => component.and(JSONComponent)
            .style('data-overlay-json', 'data-overlay-json-boolean')
            .text.set(bool ? 'true' : 'false'));
        const JSONNull = (0, kitsui_41.Component)(component => component.and(JSONComponent)
            .style('data-overlay-json', 'data-overlay-json-null')
            .text.set('null'));
        //#endregion
        ////////////////////////////////////
        const JSONValue = (value, path, hold) => {
            if (typeof value === 'string')
                return JSONString(value, path);
            if (typeof value === 'number')
                return JSONNumber(value, path);
            if (typeof value === 'boolean')
                return JSONBool(value);
            if (Array.isArray(value))
                return JSONArray(value, path, hold);
            if (value === null)
                return JSONNull();
            return JSONObject(value, path, hold);
        };
        //#endregion
        ////////////////////////////////////
        const dataTabs = (0, Tabinator_1.default)()
            .appendTo(component);
        const jsonLink = params.map(component, (params) => `/data/${params?.table ?? ''}/${params?.hash ?? ''}`);
        const jsonTab = dataTabs.Tab(jsonLink)
            .bindEnabled(params.truthy)
            .text.set(quilt => quilt['view/data/overlay/tab/main']());
        params.use(component, params => {
            if (!params)
                jsonTab.select();
        });
        (0, Loading_3.default)()
            .showForever()
            .appendToWhen(params.map(component, p => !p?.definition), jsonTab.content);
        (0, Slot_7.default)()
            .use(params, (s, params) => params && JSONValue(params.definition))
            .appendTo(jsonTab.content);
        const referencesCount = (0, kitsui_41.State)(undefined);
        const refLink = params.map(component, (params) => `/data/${params?.table ?? ''}/${params?.hash ?? ''}/references`);
        const referencesTab = dataTabs.Tab(refLink)
            .bindEnabled(params.truthy)
            .text.bind(referencesCount.map(component, count => quilt => quilt['view/data/overlay/tab/references'](count, count === undefined)));
        (0, Slot_7.default)().appendTo(referencesTab.content).use(dedupedParams, (slot, params) => {
            if (!params)
                return;
            referencesCount.value = undefined;
            const pageSize = 50;
            const referencePageProvider = DataProvider_1.default.createReferencesPaged(params.table, params.hash);
            (0, Paginator_1.default)()
                .config({
                async get(page) {
                    const state = referencePageProvider.get(pageSize, page);
                    await state.promise;
                    return state.value;
                },
                init(paginator, slot, page, data) {
                    if (!data)
                        return;
                    referencesCount.value = data.totalReferences;
                    for (let i = -5; i <= 5; i++)
                        if (page + i >= 0 && page + i < data.totalPages)
                            referencePageProvider.prep(pageSize, page + i);
                    paginator.setTotalPages(!data.totalPages ? 0 : Math.max(paginator.getTotalPages(), data.totalPages));
                    const list = (0, kitsui_41.Component)()
                        .style('data-view-definition-list')
                        .appendTo(slot);
                    for (const [component, defs] of Object.entries(data.references)) {
                        for (const definition of Object.values(defs)) {
                            DataProvider_1.default.SINGLE.prep(component, definition.hash);
                            (0, DataDefinitionButton_1.default)()
                                .tweak(button => button.data.value = { component: component, definition })
                                .appendTo(list);
                        }
                    }
                },
            })
                .appendTo(slot);
        });
        InputBus_3.default.event.until(component, event => event.subscribe('Down', (_, event) => {
            if (event.use('Escape')) {
                void navigate.toURL('/data');
            }
        }));
        return component;
    });
});
define("component/view/DataView", ["require", "exports", "component/core/Details", "component/core/DisplaySlot", "component/core/Link", "component/core/Paginator", "component/core/TabButton", "component/core/View", "component/DisplayBar", "component/Overlay", "component/overlay/DataOverlay", "component/view/data/DataDefinitionButton", "component/view/data/DataHelper", "component/view/data/DataProvider", "kitsui", "kitsui/component/Slot", "Relic"], function (require, exports, Details_3, DisplaySlot_5, Link_4, Paginator_2, TabButton_2, View_2, DisplayBar_3, Overlay_3, DataOverlay_1, DataDefinitionButton_2, DataHelper_3, DataProvider_2, kitsui_42, Slot_8, Relic_8) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Details_3 = __importDefault(Details_3);
    DisplaySlot_5 = __importDefault(DisplaySlot_5);
    Link_4 = __importDefault(Link_4);
    Paginator_2 = __importDefault(Paginator_2);
    TabButton_2 = __importDefault(TabButton_2);
    View_2 = __importDefault(View_2);
    DisplayBar_3 = __importDefault(DisplayBar_3);
    Overlay_3 = __importDefault(Overlay_3);
    DataOverlay_1 = __importDefault(DataOverlay_1);
    DataDefinitionButton_2 = __importDefault(DataDefinitionButton_2);
    DataHelper_3 = __importDefault(DataHelper_3);
    DataProvider_2 = __importDefault(DataProvider_2);
    Slot_8 = __importDefault(Slot_8);
    Relic_8 = __importDefault(Relic_8);
    const PRIORITY_COMPONENTS = [
        'DestinyInventoryItemDefinition',
        'DestinyActivityDefinition',
        'DestinySandboxPerkDefinition',
        'DestinyStatDefinition',
        'DestinyTraitDefinition',
        'DestinyVendorDefinition',
        'DeepsightMomentDefinition',
        'DeepsightItemSourceListDefinition',
        'DeepsightPlugCategorisation',
        'ClarityDescriptions',
    ];
    const DATA_DISPLAY = DisplayBar_3.default.Config({
        id: 'data',
        filterConfig: {
            id: 'data-filter',
            allowUppercase: true,
            debounceTime: 500,
            filters: [],
        },
    });
    var Breadcrumb;
    (function (Breadcrumb) {
        function equals(a, b) {
            return a?.path === b?.path && a?.name === b?.name;
        }
        Breadcrumb.equals = equals;
    })(Breadcrumb || (Breadcrumb = {}));
    exports.default = (0, View_2.default)(async (view) => {
        view.style('data-view')
            .style.bind(view.loading.loaded, 'data-view--ready');
        (0, kitsui_42.Component)()
            .style('view-title')
            .viewTransitionSwipe('data-view-title')
            .text.set(quilt => quilt['view/data/title']())
            .appendTo(view);
        view.loading.appendTo(view);
        const { signal, setProgress } = await view.loading.start();
        setProgress(null, quilt => quilt['view/data/load/connecting']());
        const conduit = await Relic_8.default.connected;
        if (signal.aborted)
            return;
        setProgress(null, quilt => quilt['view/data/load/fetching']());
        const componentNames = (0, kitsui_42.State)(await conduit.getComponentNames());
        if (signal.aborted)
            return;
        await view.loading.finish();
        view.displayBarConfig.value = DATA_DISPLAY;
        const filterText = view.displayHandlers.map(view, display => display?.filter.filterText);
        componentNames.useManual(componentNames => console.log('Component Names:', componentNames));
        (0, Slot_8.default)()
            .use({ componentNames, filterText }, (slot, { componentNames, filterText }) => {
            const indices = componentNames.toObject(name => [name, PRIORITY_COMPONENTS.indexOf(name) + 1 || Infinity]);
            componentNames.sort((a, b) => indices[a] - indices[b]);
            const dataPageProvider = DataProvider_2.default.createPaged(filterText);
            // if (!filterText) {
            for (const name of componentNames) {
                const details = (0, Details_3.default)()
                    .style('collections-view-moment')
                    .tweak(details => details
                    .style.bind(details.open, 'details--open', 'collections-view-moment--open')
                    .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment--hover'))
                    .viewTransitionSwipe(`data-view-component-${name}`);
                const filteredIn = (0, kitsui_42.State)(false);
                if (!filterText)
                    details.appendTo(slot);
                else
                    details.appendToWhen(filteredIn, slot);
                details.summary
                    .style('collections-view-moment-summary')
                    .style.bind(details.open, 'collections-view-moment-summary--open')
                    .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment-summary--hover')
                    .text.set(DataHelper_3.default.getComponentName(name));
                const openedOnce = (0, kitsui_42.State)(!!filterText);
                kitsui_42.State.Some(details, openedOnce, details.open).useManual(opened => {
                    if (!opened)
                        return;
                    openedOnce.value = true;
                    const pageSize = 50;
                    const isInitialInit = true;
                    (0, Paginator_2.default)()
                        .style('data-view-component-paginator')
                        .config({
                        async get(page) {
                            const state = dataPageProvider.get(name, pageSize, page);
                            await state.promise;
                            return state.value;
                        },
                        init(paginator, slot, page, data) {
                            const list = (0, kitsui_42.Component)()
                                .style('data-view-definition-list')
                                .appendTo(slot);
                            if (!data) {
                                console.error('Failed to load definitions page');
                                return;
                            }
                            for (let i = -5; i <= 5; i++)
                                if (page + i >= 0 && page + i < data.totalPages)
                                    dataPageProvider.prep(name, pageSize, page + i);
                            if (isInitialInit && data.totalPages && filterText) {
                                details.open.value = true;
                                filteredIn.value = true;
                            }
                            paginator.setTotalPages(!data.totalPages ? 0 : Math.max(paginator.getTotalPages(), data.totalPages));
                            for (const [, definition] of Object.entries(data.definitions)) {
                                DataProvider_2.default.SINGLE.prep(name, definition.hash);
                                (0, DataDefinitionButton_2.default)()
                                    .tweak(button => button.data.value = { component: name, definition })
                                    .appendTo(list);
                            }
                        },
                    })
                        .appendTo(details.content);
                });
            }
            return;
            // }
        })
            .appendTo(view);
        const breadcrumbs = (0, kitsui_42.State)([]);
        view.getNavbar()
            ?.overrideHomeLink('/data', view)
            .append((0, DisplaySlot_5.default)()
            .style('data-view-breadcrumbs-wrapper')
            .setOwner(view)
            .use(breadcrumbs, (slot, crumbs) => {
            const wrapper = (0, kitsui_42.Component)()
                .style('data-view-breadcrumbs')
                .appendTo(slot);
            const navigatePath = navigate.state.map(slot, url => new URL(url).pathname);
            for (const breadcrumb of crumbs) {
                const componentName = breadcrumb.path.slice(6).split('/')[0];
                const selected = navigatePath.equals(breadcrumb.path);
                (0, TabButton_2.default)(selected)
                    .and(Link_4.default, breadcrumb.path)
                    .style('data-view-breadcrumbs-button')
                    .text.set(breadcrumb.name)
                    .append((0, kitsui_42.Component)()
                    .style('data-view-breadcrumbs-button-component')
                    .text.set(DataHelper_3.default.getComponentName(componentName, true)))
                    .event.subscribe('auxclick', e => {
                    if (e.button !== 1)
                        // only handle middle-clicks
                        return;
                    const index = crumbs.indexOf(breadcrumb);
                    if (index !== -1)
                        breadcrumbs.value.splice(index, 1);
                    if (selected.value)
                        void navigate.toURL(breadcrumbs.value[index - 1]?.path ?? breadcrumbs.value[index]?.path ?? '/data');
                    e.host.remove();
                    e.preventDefault();
                })
                    .prependTo(wrapper);
            }
        }));
        ////////////////////////////////////
        //#region Data Overlay
        const overlayDefinition = kitsui_42.State.Async(view, view.params, async (params, signal, setProgress) => {
            if (!params)
                return undefined;
            const result = DataProvider_2.default.SINGLE.get(params.table, params.hash);
            if (!result)
                return undefined;
            view.loading.skipViewTransition();
            await result.promise;
            if (signal.aborted || !result.value)
                return undefined;
            const table = params.table;
            const newBreadcrumb = {
                path: `/data/${table}/${params.hash}`,
                name: DataHelper_3.default.getTitle(table, result.value.definition),
            };
            if (!breadcrumbs.value.some(bc => Breadcrumb.equals(bc, newBreadcrumb)))
                breadcrumbs.value = [...breadcrumbs.value, newBreadcrumb];
            return {
                table,
                hash: params.hash,
                definition: result.value.definition,
                links: result.value.links,
            };
        });
        const hasPendingOverlayDefinition = kitsui_42.State.Every(view, view.params.truthy, overlayDefinition.settled.falsy);
        (0, Overlay_3.default)(view).bind(kitsui_42.State.Some(view, overlayDefinition.truthy, hasPendingOverlayDefinition)).and(DataOverlay_1.default, overlayDefinition);
        //#endregion
        ////////////////////////////////////
    });
});
define("component/core/Card", ["require", "exports", "component/core/Lore", "component/core/Paragraph", "kitsui"], function (require, exports, Lore_4, Paragraph_3, kitsui_43) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Lore_4 = __importDefault(Lore_4);
    Paragraph_3 = __importDefault(Paragraph_3);
    const Card = (0, kitsui_43.Component)((component) => {
        let header;
        const flush = (0, kitsui_43.State)(false);
        return component.style('card')
            .style.bind(flush, 'card--flush')
            .style.bind(kitsui_43.State.Every(component, flush, component.hoveredOrHasFocused), 'card--flush--hover')
            .extend(card => ({
            header: undefined,
            headerText: undefined,
            description: undefined,
            descriptionText: undefined,
            flush,
        }))
            .extendJIT('header', card => header ??= (0, kitsui_43.Component)()
            .style('card-header')
            .style.bind(flush, 'card-header--flush')
            .tweak(header => {
            const text = (0, kitsui_43.Component)().style('card-header-text').appendTo(header);
            header.extendJIT('text', header => text.text.rehost(header));
        })
            .prependTo(card))
            .extendJIT('descriptionText', card => card.description.text.rehost(card))
            .extendJIT('description', card => (0, Paragraph_3.default)().and(Lore_4.default)
            .style('card-description')
            .style.bind(flush, 'card-description--flush')
            .insertTo(card, 'after', header))
            .extendJIT('headerText', card => card.header.text.rehost(card));
    });
    exports.default = Card;
});
define("component/view/SplashView", ["require", "exports", "component/core/Button", "component/core/Card", "component/core/DisplaySlot", "component/core/Link", "component/core/View", "component/profile/ProfileButton", "component/WordmarkLogo", "kitsui", "model/Profile", "Relic", "utility/Env"], function (require, exports, Button_8, Card_1, DisplaySlot_6, Link_5, View_3, ProfileButton_2, WordmarkLogo_2, kitsui_44, Profile_2, Relic_9, Env_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_8 = __importDefault(Button_8);
    Card_1 = __importDefault(Card_1);
    DisplaySlot_6 = __importDefault(DisplaySlot_6);
    Link_5 = __importDefault(Link_5);
    View_3 = __importDefault(View_3);
    ProfileButton_2 = __importDefault(ProfileButton_2);
    WordmarkLogo_2 = __importDefault(WordmarkLogo_2);
    Profile_2 = __importDefault(Profile_2);
    Relic_9 = __importDefault(Relic_9);
    Env_3 = __importDefault(Env_3);
    exports.default = (0, View_3.default)(async (view) => {
        view.hasNavbar.value = false;
        view.style('splash-view');
        view.style.bind(view.loading.loaded, 'splash-view--ready');
        (0, Link_5.default)('/')
            .and(WordmarkLogo_2.default)
            .viewTransition('wordmark-logo-home-link')
            .appendTo((0, kitsui_44.Component)()
            .style('splash-view-wordmark')
            .style.bind(view.loading.loaded, 'splash-view-wordmark--ready')
            .appendTo(view));
        view.loading.appendTo(view);
        const { signal, setProgress } = await view.loading.start();
        setProgress(null, quilt => quilt['view/splash/load/connecting']());
        const conduit = await Relic_9.default.connected;
        if (signal.aborted)
            return;
        setProgress(null, quilt => quilt['view/splash/load/profiles']());
        await Profile_2.default.init();
        if (signal.aborted)
            return;
        await view.loading.finish();
        const profiles = Profile_2.default.STATE.map(view, profiles => profiles.all);
        const hasAnyProfiles = Profile_2.default.STATE.map(view, profiles => profiles.all.length > 0);
        const authed = Profile_2.default.STATE.map(view, profiles => profiles.all.some(profile => profile.authed));
        const columns = (0, kitsui_44.Component)().style('splash-view-columns').appendTo(view.loading);
        const Column = () => (0, kitsui_44.Component)()
            .style('splash-view-column')
            .appendTo(columns);
        const Card = () => (0, Card_1.default)()
            .style('splash-view-card')
            .viewTransitionSwipe('splash-view-card')
            .tweak(card => card.flush.value = true);
        const profileColumn = Column();
        const profileCard = Card().appendTo(profileColumn);
        profileCard.headerText.set(quilt => quilt['view/splash/profile-card/title']());
        profileCard.descriptionText.set(quilt => quilt['view/splash/profile-card/description']());
        (0, DisplaySlot_6.default)()
            .style('splash-view-profile-list')
            .style.bind(authed.falsy, 'splash-view-profile-list--not-authed')
            .use(profiles, (slot, profiles) => {
            for (const profile of profiles)
                (0, ProfileButton_2.default)(profile)
                    .tweak(button => button.mode.setValue(profile.authed ? 'expanded' : 'collapsed'))
                    .appendTo(slot);
        })
            .appendToWhen(hasAnyProfiles, profileCard);
        (0, Button_8.default)()
            .text.set(quilt => quilt['view/splash/action/authenticate']())
            .event.subscribe('click', async () => {
            await conduit.ensureAuthenticated('deepsight.gg');
            void view.refresh();
        })
            .appendToWhen(authed.falsy, profileCard);
        const collectionsColumn = Column();
        const collectionsCard = Card().appendTo(collectionsColumn);
        collectionsCard.headerText.set(quilt => quilt['view/splash/collections-card/title']());
        collectionsCard.descriptionText.set(quilt => quilt['view/splash/collections-card/description']());
        (0, Link_5.default)('/collections')
            .and(Button_8.default)
            .text.set(quilt => quilt['view/splash/collections-card/action/view']())
            .appendTo(collectionsCard);
        if (Env_3.default.ENVIRONMENT === 'dev') {
            const dataCard = Card().appendTo(collectionsColumn);
            dataCard.headerText.set(quilt => quilt['view/splash/data-card/title']());
            dataCard.descriptionText.set(quilt => quilt['view/splash/data-card/description']());
            (0, Link_5.default)('/data')
                .and(Button_8.default)
                .text.set(quilt => quilt['view/splash/data-card/action/view']())
                .appendTo(dataCard);
        }
    });
});
define("navigation/Routes", ["require", "exports", "component/view/CollectionsView", "component/view/DataView", "component/view/SplashView", "navigation/Route", "navigation/RoutePath"], function (require, exports, CollectionsView_1, DataView_1, SplashView_1, Route_1, RoutePath_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    CollectionsView_1 = __importDefault(CollectionsView_1);
    DataView_1 = __importDefault(DataView_1);
    SplashView_1 = __importDefault(SplashView_1);
    Route_1 = __importDefault(Route_1);
    const Routes = [
        (0, Route_1.default)('/', SplashView_1.default),
        (0, Route_1.default)('/collections', CollectionsView_1.default),
        (0, Route_1.default)('/collections/$itemHash', CollectionsView_1.default),
        (0, Route_1.default)('/collections/$moment/$itemName', CollectionsView_1.default),
        (0, Route_1.default)('/data', DataView_1.default),
        (0, Route_1.default)('/data/$table/$hash', DataView_1.default),
        (0, Route_1.default)('/data/$table/$hash/references', DataView_1.default),
    ];
    RoutePath_1.RoutePath.setRoutes(Routes);
    exports.default = Routes;
});
define("navigation/RoutePath", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RoutePath = void 0;
    var RoutePath;
    (function (RoutePath) {
        let routes;
        function setRoutes(routesIn) {
            routes = routesIn;
        }
        RoutePath.setRoutes = setRoutes;
        function is(value) {
            return !!value && routes.some(route => route.path === value || !!route.match(value));
        }
        RoutePath.is = is;
    })(RoutePath || (exports.RoutePath = RoutePath = {}));
});
define("navigation/Navigate", ["require", "exports", "kitsui", "kitsui/component/Dialog", "kitsui/component/Popover", "kitsui/utility/EventManipulator", "navigation/Routes"], function (require, exports, kitsui_45, Dialog_1, Popover_2, EventManipulator_1, Routes_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Dialog_1 = __importDefault(Dialog_1);
    Popover_2 = __importDefault(Popover_2);
    EventManipulator_1 = __importDefault(EventManipulator_1);
    Routes_1 = __importDefault(Routes_1);
    function Navigator() {
        const state = (0, kitsui_45.State)(location.href);
        const hash = (0, kitsui_45.State)(location.hash);
        let lastURL;
        const navigate = {
            state,
            hash,
            event: undefined,
            isURL: (glob) => {
                const pattern = glob
                    .replace(/(?<=\/)\*(?!\*)/g, '[^/]*')
                    .replace(/\/\*\*/g, '.*');
                return new RegExp(`^${pattern}$`).test(location.pathname);
            },
            fromURL: async () => navigateFromCurrentURL(),
            refresh: async () => navigateFromCurrentURL(true),
            toURL: async (url) => {
                navigate.setURL(url, false);
                return navigate.fromURL();
            },
            setURL: (url, updateLast = true) => {
                if (url !== location.pathname) {
                    history.pushState({}, '', `${location.origin}${url}`);
                    if (updateLast)
                        lastURL = new URL(location.href);
                }
            },
            toRawURL: (url) => {
                if (url.startsWith('http')) {
                    location.href = url;
                    return true;
                }
                if (url.startsWith('/')) {
                    void navigate.toURL(url);
                    return true;
                }
                if (url.startsWith('#')) {
                    const id = url.slice(1);
                    const element = document.getElementById(id);
                    if (!element) {
                        console.error(`No element by ID: "${id}"`);
                        return false;
                    }
                    location.hash = url;
                    hash.value = location.hash;
                    return true;
                }
                console.error(`Unsupported raw URL to navigate to: "${url}"`);
                return false;
            },
            // ephemeral: (...args: unknown[]) => {
            // 	if (!app)
            // 		throw new Error('Cannot show ephemeral view yet, no app instance')
            // 	// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
            // 	return (app.view.showEphemeral as any)(...args)
            // },
        };
        Object.assign(navigate, {
            event: (0, EventManipulator_1.default)(navigate),
        });
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        window.addEventListener('popstate', navigate.fromURL);
        Object.assign(window, { navigate });
        return navigate;
        async function navigateFromCurrentURL(force) {
            if (location.href === lastURL?.href && !force)
                return;
            // if (!app)
            // 	throw new Error('Cannot navigate yet, no app instance')
            const oldURL = lastURL;
            lastURL = new URL(location.href);
            state.value = location.href;
            hash.value = location.hash;
            let matchedRoute;
            if (location.pathname !== oldURL?.pathname || force) {
                const url = location.pathname;
                let handled = false;
                for (const route of Routes_1.default) {
                    const params = route.match(url);
                    if (!params)
                        continue;
                    matchedRoute = route.path;
                    await route.handler((!Object.keys(params).length ? undefined : params));
                    handled = true;
                    break;
                }
                if (!handled) {
                    console.error('TODO implement error view');
                    // await app.view.show(ErrorView, { code: 404 })
                }
            }
            else if (location.hash !== oldURL?.hash) {
                hash.value = location.hash;
                navigate.event.emit('HashChange', location.hash, oldURL?.hash);
            }
            navigate.event.emit('Navigate', matchedRoute);
            Popover_2.default.forceCloseAll();
            Dialog_1.default.forceCloseAll();
        }
    }
    // let app: App | undefined
    // namespace Navigator {
    // 	export function setApp (instance: App) {
    // 		app = instance
    // 	}
    // }
    exports.default = Navigator;
});
define("utility/Script", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Script;
    (function (Script) {
        function allowModuleRedefinition(...paths) {
            for (const path of paths)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                window.allowRedefine(path);
        }
        Script.allowModuleRedefinition = allowModuleRedefinition;
        async function reload(path) {
            document.querySelector(`script[src^="${path}"]`)?.remove();
            const script = document.createElement('script');
            script.src = `${path}?${Date.now()}`;
            return new Promise((resolve, reject) => {
                script.onload = () => resolve();
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        Script.reload = reload;
    })(Script || (Script = {}));
    exports.default = Script;
});
define("utility/Style", ["require", "exports", "kitsui/utility/StyleManipulator", "style", "utility/Script"], function (require, exports, StyleManipulator_1, style_1, Script_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    style_1 = __importDefault(style_1);
    Script_1 = __importDefault(Script_1);
    StyleManipulator_1.style.value = style_1.default;
    var Style;
    (function (Style) {
        let reloading;
        async function reload() {
            while (reloading)
                await reloading;
            await (reloading = (async () => {
                const stylesheetReloaded = reloadStylesheet(`${location.origin}/style/index.css`);
                Script_1.default.allowModuleRedefinition('style');
                await Script_1.default.reload(`${location.origin}/style/index.js`);
                StyleManipulator_1.style.value = await new Promise((resolve_1, reject_1) => { require(['style'], resolve_1, reject_1); }).then(__importStar).then(module => module.default);
                await stylesheetReloaded;
            })());
            reloading = undefined;
        }
        Style.reload = reload;
        async function reloadStylesheet(path) {
            const oldStyle = document.querySelector(`link[rel=stylesheet][href^="${path}"]`);
            const style = document.createElement('link');
            style.rel = 'stylesheet';
            style.href = `${path}?${Date.now()}`;
            return new Promise((resolve, reject) => {
                style.onload = () => resolve();
                style.onerror = reject;
                document.head.appendChild(style);
            }).finally(() => oldStyle?.remove());
        }
    })(Style || (Style = {}));
    exports.default = Style;
});
define("utility/DevServer", ["require", "exports", "utility/Env", "utility/Style"], function (require, exports, Env_4, Style_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Env_4 = __importDefault(Env_4);
    Style_1 = __importDefault(Style_1);
    var DevServer;
    (function (DevServer) {
        function listen() {
            if (Env_4.default.ENVIRONMENT !== 'dev')
                return;
            const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${location.host}`;
            const socket = new WebSocket(wsUrl);
            socket.addEventListener('message', event => {
                try {
                    if (typeof event.data !== 'string')
                        throw new Error('Unsupported message data');
                    const message = JSON.parse(event.data);
                    const { type } = typeof message === 'object' && message !== null ? message : {};
                    switch (type) {
                        case 'notify:css':
                            void Style_1.default.reload();
                            break;
                    }
                }
                catch {
                    console.warn('Unsupported devserver message:', event.data);
                }
            });
        }
        DevServer.listen = listen;
    })(DevServer || (DevServer = {}));
    exports.default = DevServer;
});
define("index", ["require", "exports", "component/Kit", "kitsui", "kitsui/utility/ActiveListener", "kitsui/utility/FocusListener", "kitsui/utility/HoverListener", "kitsui/utility/Mouse", "kitsui/utility/Viewport", "model/Profile", "navigation/Navigate", "Relic", "utility/Arrays", "utility/DevServer", "utility/Env", "utility/Text"], function (require, exports, Kit_1, kitsui_46, ActiveListener_1, FocusListener_1, HoverListener_1, Mouse_2, Viewport_1, Profile_3, Navigate_1, Relic_10, Arrays_6, DevServer_1, Env_5, Text_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = default_1;
    Kit_1 = __importDefault(Kit_1);
    ActiveListener_1 = __importDefault(ActiveListener_1);
    FocusListener_1 = __importDefault(FocusListener_1);
    HoverListener_1 = __importDefault(HoverListener_1);
    Mouse_2 = __importDefault(Mouse_2);
    Viewport_1 = __importDefault(Viewport_1);
    Profile_3 = __importDefault(Profile_3);
    Navigate_1 = __importDefault(Navigate_1);
    Relic_10 = __importDefault(Relic_10);
    Arrays_6 = __importDefault(Arrays_6);
    DevServer_1 = __importDefault(DevServer_1);
    Env_5 = __importDefault(Env_5);
    Text_2 = __importDefault(Text_2);
    Arrays_6.default.applyPrototypes();
    async function default_1() {
        kitsui_46.Component.allowBuilding();
        Text_2.default.init();
        kitsui_46.Component.getBody().style('body');
        await Env_5.default['init']();
        void Relic_10.default.init();
        void Profile_3.default.init();
        DevServer_1.default.listen();
        HoverListener_1.default.listen();
        ActiveListener_1.default.listen();
        FocusListener_1.default.listen();
        Mouse_2.default.listen();
        Viewport_1.default.listen();
        kitsui_46.Component.getBody().monitorScrollEvents();
        kitsui_46.Component.getDocument().monitorScrollEvents();
        kitsui_46.Component.getWindow().monitorScrollEvents();
        (0, Kit_1.default)();
        await (0, Navigate_1.default)().fromURL();
    }
});
define("component/core/ActionRow", ["require", "exports", "kitsui"], function (require, exports, kitsui_47) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_47.Component)(component => component.style('action-row'));
});
define("component/core/Checkbox", ["require", "exports", "kitsui"], function (require, exports, kitsui_48) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Checkbox = (0, kitsui_48.Component)('label', (component) => {
        const label = (0, kitsui_48.Component)().style('checkbox-label');
        const checked = (0, kitsui_48.State)(false);
        const input = (0, kitsui_48.Component)('input')
            .style('checkbox-input')
            .attributes.set('type', 'checkbox')
            .event.subscribe('change', event => checked.value = event.host.element.checked);
        return component.style('checkbox')
            .append(input)
            .append((0, kitsui_48.Component)()
            .style('checkbox-icon')
            .style.bind(checked, 'checkbox-icon--checked')
            .append((0, kitsui_48.Component)()
            .style('checkbox-icon-active-border')
            .style.bind(component.hoveredOrHasFocused, 'checkbox-icon-active-border--focus')
            .style.bind(component.active, 'checkbox-icon-active-border--active')
            .style.bind(checked, 'checkbox-icon-active-border--checked'))
            .append((0, kitsui_48.Component)()
            .style('checkbox-icon-check')
            .style.bind(checked, 'checkbox-icon-check--checked')
            .style.bind(component.active, 'checkbox-icon-check--active')))
            .append(label)
            .extend(checkbox => ({
            checked,
            label,
        }));
    });
    exports.default = Checkbox;
});
define("component/core/Checklist", ["require", "exports", "kitsui"], function (require, exports, kitsui_49) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Checklist = (0, kitsui_49.Component)('ol', (component) => {
        return component.style('checklist')
            .extend(checklist => ({
            add(initialiser) {
                ChecklistItem()
                    .tweak(initialiser)
                    .appendTo(checklist)
                    .tweak(item => item.marker.text.set(`${checklist.element.children.length}.`));
                return checklist;
            },
        }));
    });
    const ChecklistItem = (0, kitsui_49.Component)('li', (component) => {
        const checked = (0, kitsui_49.State)(false);
        const marker = (0, kitsui_49.Component)().style('checklist-item-marker');
        const content = (0, kitsui_49.Component)().style('checklist-item-content');
        const checkIcon = (0, kitsui_49.Component)()
            .style('checklist-item-check-icon')
            .style.bind(checked, 'checklist-item-check-icon--checked');
        return component.style('checklist-item')
            .append(marker, content, checkIcon)
            .extend(item => ({
            marker,
            content,
            checkIcon,
            checked,
        }));
    });
    exports.default = Checklist;
});
define("component/core/Footer", ["require", "exports", "kitsui"], function (require, exports, kitsui_50) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_50.Component)(component => component.style('footer'));
});
define("component/core/FormRow", ["require", "exports", "kitsui"], function (require, exports, kitsui_51) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const FormRow = (0, kitsui_51.Component)('label', (component) => {
        const label = (0, kitsui_51.Component)().style('form-row-label');
        return component.replaceElement('label')
            .style('form-row')
            .append(label)
            .extend(row => ({
            label,
            labelText: undefined,
        }))
            .extendJIT('labelText', row => row.label.text.rehost(row));
    });
    exports.default = FormRow;
});
define("component/core/TextInput", ["require", "exports", "kitsui", "kitsui/utility/Applicator"], function (require, exports, kitsui_52, Applicator_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Applicator_1 = __importDefault(Applicator_1);
    const TextInput = (0, kitsui_52.Component)('input', (component) => {
        let defaultValue = '';
        const state = (0, kitsui_52.State)(defaultValue);
        const input = component.replaceElement('input')
            .attributes.set('type', 'text')
            .style('text-input');
        input.event.subscribe('input', () => state.value = input.element.value);
        return input.extend(input => ({
            state,
            setValue(value) {
                state.value = input.element.value = value ?? '';
                return input;
            },
            default: (0, Applicator_1.default)(input, (newDefaultValue = '') => {
                if (newDefaultValue === defaultValue)
                    return;
                if (input.element.value === defaultValue)
                    state.value = input.element.value = newDefaultValue;
                defaultValue = newDefaultValue;
            }),
            reset() {
                state.value = input.element.value = defaultValue;
                return input;
            },
        }));
    });
    exports.default = TextInput;
});
define("utility/Async", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sleep = sleep;
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
