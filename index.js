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
            const oldModuleName = extensibleSelf.__moduleName;
            extensibleSelf.__moduleName = module._name;
            const result = module._initializer(require, module, ...args);
            if (extensibleSelf.__moduleName === module._name)
                extensibleSelf.__moduleName = oldModuleName;
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
     * @property {string | undefined} __moduleName
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
        cb = typeof cb === 'function' ? cb : cb?.update ?? undefined;
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
            const dots = [1, 2, 3, 4].map(i => (0, kitsui_3.Component)().style('loading-spinner-dot', `loading-spinner-dot-${i}`));
            loading.spinner.append(...dots);
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            const interval = setInterval(async () => {
                for (const dot of dots)
                    dot.style('loading-spinner-dot--no-animate');
                await new Promise(resolve => setTimeout(resolve, 10));
                for (const dot of dots)
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
define("component/core/Image", ["require", "exports", "kitsui", "kitsui/utility/Task"], function (require, exports, kitsui_8, Task_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Task_1 = __importDefault(Task_1);
    const Image = (0, kitsui_8.Component)('img', (component, src, fallback) => {
        src = kitsui_8.State.get(src);
        const state = (0, kitsui_8.State)(undefined);
        const dimensions = (0, kitsui_8.State)(undefined);
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
                    state.value = undefined;
                    dimensions.value = undefined;
                    await Task_1.default.yield();
                    if (signal.aborted)
                        return;
                }
                component.attributes.set('src', src);
                state.value = undefined;
                dimensions.value = undefined;
            });
            image.event.subscribe('load', () => {
                image.style('image--loaded');
                state.value = image.element.src;
                if (image.element.src !== fallback)
                    dimensions.value = {
                        width: image.element.naturalWidth,
                        height: image.element.naturalHeight,
                    };
            });
            image.event.subscribe('error', () => {
                component.attributes.set('src', fallback);
                state.value = undefined;
                dimensions.value = undefined;
            });
        })
            .extend(image => ({
            state,
            dimensions,
        }));
    });
    exports.default = Image;
});
define("utility/Text", ["require", "exports", "kitsui", "kitsui/utility/StringApplicator", "lang"], function (require, exports, kitsui_9, StringApplicator_1, lang_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.quilt = void 0;
    lang_1 = __importStar(lang_1);
    exports.quilt = (0, kitsui_9.State)(lang_1.default);
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
                else if (kitsui_9.Component.is(weft.content))
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
                        element.append((0, kitsui_9.Component)('br').element, (0, kitsui_9.Component)().style('break').element);
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
                return (0, kitsui_9.Component)('a')
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
                case 'code': return (0, kitsui_9.Component)('code').style('code').element;
                // case 'sm': return Component('small')
                // 	.style('small')
                // 	.element
            }
        }
        Text.createTagElement = createTagElement;
    })(Text || (Text = {}));
    exports.default = Text;
});
define("component/display/Filter", ["require", "exports", "component/core/Button", "component/core/DisplaySlot", "component/core/Image", "kitsui", "kitsui/component/Popover", "kitsui/component/Slot", "kitsui/utility/Arrays", "kitsui/utility/InputBus", "kitsui/utility/Mouse", "kitsui/utility/Task", "utility/Text"], function (require, exports, Button_1, DisplaySlot_1, Image_1, kitsui_10, Popover_1, Slot_2, Arrays_2, InputBus_1, Mouse_1, Task_2, Text_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PLAINTEXT_FILTER_TWEAK_CHIP = exports.PLAINTEXT_FILTER_IS_VALID = exports.FilterToken = void 0;
    Button_1 = __importDefault(Button_1);
    DisplaySlot_1 = __importDefault(DisplaySlot_1);
    Image_1 = __importDefault(Image_1);
    Popover_1 = __importDefault(Popover_1);
    Slot_2 = __importDefault(Slot_2);
    InputBus_1 = __importDefault(InputBus_1);
    Mouse_1 = __importDefault(Mouse_1);
    Task_2 = __importDefault(Task_2);
    var FilterToken;
    (function (FilterToken) {
        function create(text, start = 0, end = text.length) {
            return Object.assign(String(text), {
                lowercase: (text
                    .toLowerCase()
                    .replace(EMOJI_REGEX, '')
                    .replaceAll('"', '')),
                displayText: (text
                    .replaceAll(' ', '\xa0')
                    .replace(EMOJI_REGEX, '')),
                start,
                end,
            });
        }
        FilterToken.create = create;
    })(FilterToken || (exports.FilterToken = FilterToken = {}));
    const FilterIcon = (0, kitsui_10.Component)((component, id) => {
        const visible = (0, kitsui_10.State)(true);
        return component
            .style('filter-display-chip-icon', `filter-display-chip-icon--${id}`)
            .extend(icon => ({
            visible,
            setImage(image, tweak) {
                image = kitsui_10.State.get(image);
                visible.bind(icon, image.truthy);
                (0, Image_1.default)(image)
                    .style('filter-display-chip-icon-image', `filter-display-chip-icon-image--${id}`)
                    .tweak(tweak)
                    .appendToWhen(image.truthy, icon);
                return icon;
            },
        }));
    });
    const PLAINTEXT_FILTER_IS_VALID = (token) => token.lowercase.length >= 3;
    exports.PLAINTEXT_FILTER_IS_VALID = PLAINTEXT_FILTER_IS_VALID;
    const PLAINTEXT_FILTER_FUNCTION = (item, token) => item.displayProperties.name.toLowerCase().includes(token.lowercase);
    const PLAINTEXT_FILTER_TWEAK_CHIP = (chip, token) => chip
        .style('filter-display-text')
        .style.toggle(!(0, exports.PLAINTEXT_FILTER_IS_VALID)(token), 'filter-display-text--inactive');
    exports.PLAINTEXT_FILTER_TWEAK_CHIP = PLAINTEXT_FILTER_TWEAK_CHIP;
    const EMOJI_ICON_PLACEHOLDER = '⬛';
    const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const EMOJI_SPACE_PLACEHOLDER = '–';
    const EMOJI_OR_WHITESPACE_REGEX = /[– ]+/gu;
    const Chip = (0, kitsui_10.Component)((component, match) => {
        const collapsedSuggestion = 'isCollapsedSuggestion' in match ? match : undefined;
        const iconWrapper = match.icon && (0, kitsui_10.Component)()
            .style('filter-display-chip-icon-wrapper')
            .style.toggle(!!match.doubleWidthIcon, 'filter-display-chip-icon-wrapper--double-width');
        const iconPlaceholder = iconWrapper && (0, kitsui_10.Component)()
            .style('filter-display-chip-icon-placeholder')
            .text.set(EMOJI_ICON_PLACEHOLDER.repeat(match.doubleWidthIcon ? 2 : 1))
            .appendTo(iconWrapper);
        const matchIconDefinition = !kitsui_10.State.is(match.icon) && typeof match.icon === 'object' ? match.icon : undefined;
        const icon = iconWrapper && FilterIcon(match.id)
            .tweak(icon => icon
            .setImage(kitsui_10.State.is(match.icon) ? match.icon : matchIconDefinition?.image)
            .tweak(matchIconDefinition?.tweak, match.token))
            .appendTo(iconWrapper);
        const textWrapper = (0, kitsui_10.Component)()
            .style('filter-display-chip-text-wrapper');
        const displayText = collapsedSuggestion
            ? quilt => quilt['display-bar/filter/collapsed'](quilt[collapsedSuggestion.definition.hint]())
            : match.token?.displayText;
        (0, kitsui_10.Component)()
            .style('filter-display-chip-text-placeholder')
            .text.set(displayText)
            .appendTo(textWrapper);
        const labelText = (0, kitsui_10.Component)()
            .style('filter-display-chip-text-label')
            .style.toggle(!!collapsedSuggestion, 'filter-display-chip-text-label--collapsed')
            .text.set(collapsedSuggestion?.definition.applies)
            .appendTo(textWrapper);
        const filterText = (0, kitsui_10.Component)()
            .style('filter-display-chip-text-main')
            .style.toggle(!!collapsedSuggestion, 'filter-display-chip-text-main--collapsed')
            .text.set(displayText)
            .appendTo(textWrapper);
        return component
            .style('filter-display-chip', `filter-display-chip--${match.id}`)
            .tweak(c => icon && c.appendWhen(icon.visible, iconWrapper))
            .append(textWrapper)
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
    const Filter = Object.assign((0, kitsui_10.Component)((component) => {
        const filter = component.style('filter');
        const config = (0, kitsui_10.State)(undefined);
        let filtersOwner;
        const filterFromParam = new URLSearchParams(window.location.search).get('filter');
        const filterText = (0, kitsui_10.State)(filterFromParam ?? '');
        const caretPosition = (0, kitsui_10.State)(0);
        const reapplyFilterSearchParam = () => navigate.search.set('filter', filterText.value?.replace(EMOJI_REGEX, '') || null);
        filterText.use(filter, reapplyFilterSearchParam);
        ////////////////////////////////////
        //#region Filter Parsing
        const filters = kitsui_10.State.Map(filter, [filterText, config], (text, config) => {
            filtersOwner?.remove();
            filtersOwner = kitsui_10.State.Owner.create();
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
                    chip: config?.plaintextFilterTweakChip ?? exports.PLAINTEXT_FILTER_TWEAK_CHIP,
                });
            }
            return filters;
        });
        const selectedToken = kitsui_10.State.MapManual([filters, caretPosition], (filters, caretPosition) => {
            if (caretPosition === undefined)
                return undefined;
            for (const filter of filters)
                if (caretPosition >= filter.token.start && caretPosition <= filter.token.end)
                    return filter.token;
            return undefined;
        });
        let filterFullTextsOwner;
        const filterFullTexts = filters.mapManual(filters => {
            filterFullTextsOwner?.remove();
            filterFullTextsOwner = kitsui_10.State.Owner.create();
            return kitsui_10.State.Map(filterFullTextsOwner, filters.map(filter => kitsui_10.State.get(filter.fullText)), (...texts) => (texts
                .map((fullText, i) => ({ fullText, match: filters[i] }))));
        });
        const appliedFilters = filters.mapManual(filters => filters.filter(filter => true
            && (filter.id !== 'plaintext' || (config.value?.plaintextFilterIsValid ?? exports.PLAINTEXT_FILTER_IS_VALID)(filter.token))
            && !(filter.token.endsWith(':') && kitsui_10.State.value(filter.isPartial))));
        const appliedFilterText = appliedFilters.mapManual(filters => filters
            .map(filter => `"${((config.value?.allowUppercase ? filter.token.slice() : filter.token.lowercase)
            .replaceAll('"', ''))}"`)
            .join(' '));
        let noPartialFiltersOwner;
        const noPartialFilters = filters.mapManual(filters => {
            noPartialFiltersOwner?.remove();
            noPartialFiltersOwner = kitsui_10.State.Owner.create();
            return kitsui_10.State.Map(noPartialFiltersOwner, filters.map(filter => kitsui_10.State.get(filter.isPartial)), (...partialStates) => !partialStates.includes(true));
        });
        const debounceFinished = (0, kitsui_10.State)(true);
        let filterTextEditTimeout;
        appliedFilterText.useManual(filterText => {
            debounceFinished.value = false;
            clearTimeout(filterTextEditTimeout);
            filterTextEditTimeout = window.setTimeout(() => {
                debounceFinished.value = true;
            }, config.value?.debounceTime ?? 200);
        });
        let oldFilterText = '';
        const debouncedFilterText = kitsui_10.State.MapManual([appliedFilterText, noPartialFilters, debounceFinished], (filterText, noPartialFilters, debounceFinished) => {
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
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Input
        const input = (0, kitsui_10.Component)('input')
            .attributes.set('type', 'text')
            .attributes.set('spellcheck', 'false')
            .attributes.bind('placeholder', Text_1.quilt.map(filter, quilt => quilt['display-bar/filter/placeholder']().toString()))
            .style('filter-input')
            .style.bind(component.hasFocused, 'filter-input--has-focus')
            .style.bind(filterText.truthy, 'filter-input--has-content')
            .event.subscribe('input', e => filterText.value = e.host.element.value)
            .event.subscribe('selectionchange', e => caretPosition.value = e.host.element.selectionStart === e.host.element.selectionEnd ? e.host.element.selectionStart ?? undefined : undefined)
            .appendTo(filter);
        input.element.value = filterText.value;
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
                const icon = typeof filter.icon !== 'object' ? filter.icon : (kitsui_10.State.is(filter.icon) ? filter.icon.value : kitsui_10.State.is(filter.icon.image) ? filter.icon.image.value : filter.icon.image);
                if (icon) {
                    // insert a ⬛ emoji at the start of tokens with icon
                    const start = filter.token.start;
                    const iconPlaceholder = EMOJI_ICON_PLACEHOLDER.repeat(filter.doubleWidthIcon ? 2 : 1);
                    spliceInput(start, start, iconPlaceholder, true);
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
        (0, kitsui_10.Component)()
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
                            lastComponent = newDisplayDataItem.component = (0, kitsui_10.Component)()
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
        const mouseWithinPopover = kitsui_10.State.Map(popover, [Mouse_1.default.state, popover.visible], (mouse, visible) => visible && popover.isMouseWithin());
        const hasFilters = config.map(popover, config => !!config?.filters.length);
        kitsui_10.State.Every(popover, hasFilters, kitsui_10.State.Some(popover, input.hasFocused, popover.hasFocused, mouseWithinPopover)).subscribe(popover, async (focused) => {
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
            await Task_2.default.yield();
            popover.anchor.apply();
            await Task_2.default.yield();
            popover.style.removeProperties('visibility');
        });
        (0, kitsui_10.Component)()
            .style('filter-popover-title')
            .text.set(quilt => quilt['display-bar/filter/suggestions/title']())
            .appendTo(popover);
        (0, DisplaySlot_1.default)()
            .style('filter-popover-suggestions-wrapper')
            .use({ config, appliedFilters }, (slot, { config, appliedFilters }) => {
            for (const filter of config?.filters ?? []) {
                const suggestions = kitsui_10.State.get(typeof filter.suggestions === 'function' ? filter.suggestions(slot, appliedFilters) : filter.suggestions);
                const collapsed = kitsui_10.State.get(typeof filter.collapsed === 'function' ? filter.collapsed(slot, appliedFilters) : filter.collapsed);
                (0, Slot_2.default)().appendTo(slot).use({ suggestions, collapsed }, (slot, { suggestions, collapsed }) => {
                    const suggestionMatches = (Array.isArray(suggestions) ? suggestions : suggestions.all)
                        .distinct()
                        .map((suggestion) => {
                        const token = FilterToken.create(suggestion);
                        const match = filter.match(slot, token);
                        if (!match)
                            return undefined;
                        return Object.assign(match, { token, id: filter.id });
                    })
                        .filter(Arrays_2.NonNullish);
                    async function spliceSuggestion(newText) {
                        spliceInput(selectedToken.value?.start ?? caretPosition.value ?? 0, selectedToken.value?.end ?? caretPosition.value ?? 0, newText);
                        filterText.value = input.element.value;
                        const selectionStart = input.element.selectionStart;
                        const selectionEnd = input.element.selectionEnd;
                        const selectionDirection = input.element.selectionDirection;
                        await Task_2.default.yield();
                        input.focus();
                        input.element.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? undefined);
                    }
                    if (collapsed)
                        (0, Button_1.default)()
                            .tweak(button => button.textWrapper.remove())
                            .and(Chip, { isCollapsedSuggestion: true, id: filter.id, definition: collapsed })
                            .style.remove('filter-display-chip')
                            .style('filter-popover-suggestion')
                            .tweak(chip => chip.textWrapper.style('filter-popover-suggestion-text-wrapper'))
                            .append((0, kitsui_10.Component)().style('filter-popover-suggestion-colour-wrapper'))
                            .event.subscribe('click', e => {
                            const newText = collapsed?.applies;
                            if (!newText)
                                return;
                            spliceSuggestion(newText);
                        })
                            .appendToWhen(kitsui_10.State.Map(slot, [selectedToken, filterFullTexts], (selectedToken, filters) => {
                            const lowercase = collapsed?.applies;
                            return !!lowercase
                                // ensure the suggestion matches the current filter text
                                && (!selectedToken || (lowercase.startsWith(selectedToken.lowercase) && lowercase.length > selectedToken.lowercase.length));
                        }), slot);
                    for (const suggestion of suggestionMatches)
                        (0, Button_1.default)()
                            .tweak(button => button.textWrapper.remove())
                            .and(Chip, suggestion)
                            .style.remove('filter-display-chip')
                            .style('filter-popover-suggestion')
                            .tweak(chip => chip.textWrapper.style('filter-popover-suggestion-text-wrapper'))
                            .append((0, kitsui_10.Component)().style('filter-popover-suggestion-colour-wrapper'))
                            .event.subscribe('click', e => {
                            let newText = suggestion.token.lowercase;
                            if (newText.includes(' ')) {
                                const prefix = newText.slice(0, newText.indexOf(':') + 1);
                                newText = `${prefix}"${newText.slice(prefix.length)}"`;
                            }
                            spliceSuggestion(`${newText} `);
                        })
                            .appendToWhen(kitsui_10.State.Map(slot, [selectedToken, filterFullTexts], (selectedToken, filters) => {
                            const lowercase = suggestion.token.lowercase;
                            return true
                                // this suggestion isn't already something we're filtering by
                                && !filters.some(filter => filter.fullText === lowercase && filter.match.token !== selectedToken)
                                // ensure the suggestion matches the current filter text
                                && (!selectedToken
                                    ? !collapsed
                                    : lowercase.startsWith(selectedToken.lowercase) && (!collapsed || selectedToken.lowercase.startsWith(collapsed.applies)))
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
            reapplyFilterSearchParam,
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
define("component/DisplayBar", ["require", "exports", "component/core/Button", "component/display/Filter", "kitsui"], function (require, exports, Button_2, Filter_1, kitsui_11) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_2 = __importDefault(Button_2);
    Filter_1 = __importDefault(Filter_1);
    const DisplayBarButton = (0, kitsui_11.Component)((component) => {
        const button = component.and(Button_2.default)
            .style.remove('button')
            .tweak(button => button.textWrapper.remove())
            .style('display-bar-button')
            .style.bind(component.hoveredOrHasFocused, 'display-bar-button--hover')
            .style.bind(component.active, 'display-bar-button--active');
        (0, kitsui_11.Component)()
            .style('display-bar-button-icon')
            .appendTo(button);
        const title = (0, kitsui_11.Component)()
            .style('display-bar-button-title')
            .appendTo(button);
        const subtitle = (0, kitsui_11.Component)()
            .style('display-bar-button-subtitle')
            .appendTo(button);
        return button.extend(button => ({
            title,
            titleText: title.text.rehost(button),
            subtitle,
            subtitleText: subtitle.text.rehost(button),
        }));
    });
    const DisplayBar = Object.assign((0, kitsui_11.Component)((component) => {
        component.style('display-bar');
        const config = (0, kitsui_11.State)(undefined);
        const noSort = config.mapManual(config => !config?.sortConfig);
        DisplayBarButton()
            .style('display-bar-sort-button')
            .style.bind(noSort, 'display-bar-button--disabled')
            .attributes.bind(noSort, 'inert')
            .titleText.set(quilt => quilt['display-bar/sort/title']())
            .appendTo(component);
        const filter = (0, Filter_1.default)();
        filter.config.bind(filter, config.map(filter, config => ({
            id: 'display-bar-default-filter',
            filters: [],
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
            button.subtitle
                .style('display-bar-filter-button-subtitle')
                .append(filter);
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
            .appendToWhen(config.truthy, kitsui_11.Component.getBody());
    }), {
        Config(config) {
            return config;
        },
    });
    exports.default = DisplayBar;
});
define("component/core/Link", ["require", "exports", "kitsui"], function (require, exports, kitsui_12) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Link = (0, kitsui_12.Component)('a', (component, hrefIn) => {
        const href = (0, kitsui_12.State)('/');
        href.bind(component, kitsui_12.State.get(hrefIn));
        const overrideClick = (0, kitsui_12.State)(true);
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
        Icons["WeaponTraceRifle"] = "weapon-trace-rifle";
        Icons["WeaponSword"] = "weapon-sword";
        Icons["WeaponSubmachineGun"] = "weapon-submachine-gun";
        Icons["WeaponSniperRifle"] = "weapon-sniper-rifle";
        Icons["WeaponSidearm"] = "weapon-sidearm";
        Icons["WeaponShotgun"] = "weapon-shotgun";
        Icons["WeaponScoutRifle"] = "weapon-scout-rifle";
        Icons["WeaponRocketLauncher"] = "weapon-rocket-launcher";
        Icons["WeaponPulseRifle"] = "weapon-pulse-rifle";
        Icons["WeaponMachineGun"] = "weapon-machine-gun";
        Icons["WeaponLinearFusionRifle"] = "weapon-linear-fusion-rifle";
        Icons["WeaponHandCannon"] = "weapon-hand-cannon";
        Icons["WeaponGrenadeLauncher"] = "weapon-grenade-launcher";
        Icons["WeaponGrenadeLauncherHeavy"] = "weapon-grenade-launcher-heavy";
        Icons["WeaponGlaive"] = "weapon-glaive";
        Icons["WeaponFusionRifle"] = "weapon-fusion-rifle";
        Icons["WeaponBow"] = "weapon-bow";
        Icons["WeaponAutoRifle"] = "weapon-auto-rifle";
        Icons["Power"] = "power";
        Icons["DamageVoid"] = "damage-void";
        Icons["DamageStrand"] = "damage-strand";
        Icons["DamageStasis"] = "damage-stasis";
        Icons["DamageSolar"] = "damage-solar";
        Icons["DamagePrismatic"] = "damage-prismatic";
        Icons["DamageKinetic"] = "damage-kinetic";
        Icons["DamageArc"] = "damage-arc";
        Icons["AmmoSpecial"] = "ammo-special";
        Icons["AmmoPrimary"] = "ammo-primary";
        Icons["AmmoHeavy"] = "ammo-heavy";
    })(Icons || (exports.Icons = Icons = {}));
    exports.ICONS_CODEPOINTS = {
        [Icons.WeaponTraceRifle]: "61697",
        [Icons.WeaponSword]: "61698",
        [Icons.WeaponSubmachineGun]: "61699",
        [Icons.WeaponSniperRifle]: "61700",
        [Icons.WeaponSidearm]: "61701",
        [Icons.WeaponShotgun]: "61702",
        [Icons.WeaponScoutRifle]: "61703",
        [Icons.WeaponRocketLauncher]: "61704",
        [Icons.WeaponPulseRifle]: "61705",
        [Icons.WeaponMachineGun]: "61706",
        [Icons.WeaponLinearFusionRifle]: "61707",
        [Icons.WeaponHandCannon]: "61708",
        [Icons.WeaponGrenadeLauncher]: "61709",
        [Icons.WeaponGrenadeLauncherHeavy]: "61710",
        [Icons.WeaponGlaive]: "61711",
        [Icons.WeaponFusionRifle]: "61712",
        [Icons.WeaponBow]: "61713",
        [Icons.WeaponAutoRifle]: "61714",
        [Icons.Power]: "61715",
        [Icons.DamageVoid]: "61716",
        [Icons.DamageStrand]: "61717",
        [Icons.DamageStasis]: "61718",
        [Icons.DamageSolar]: "61719",
        [Icons.DamagePrismatic]: "61720",
        [Icons.DamageKinetic]: "61721",
        [Icons.DamageArc]: "61722",
        [Icons.AmmoSpecial]: "61723",
        [Icons.AmmoPrimary]: "61724",
        [Icons.AmmoHeavy]: "61725",
    };
});
define("component/core/Icon", ["require", "exports", "kitsui", "style/icons"], function (require, exports, kitsui_13, icons_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Icon = (0, kitsui_13.Component)((component, icon) => {
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
define("component/profile/ProfileButton", ["require", "exports", "component/core/Button", "component/core/Icon", "kitsui"], function (require, exports, Button_3, Icon_1, kitsui_14) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_3 = __importDefault(Button_3);
    Icon_1 = __importDefault(Icon_1);
    const ProfileButton = (0, kitsui_14.Component)((component, profile) => {
        const displayMode = (0, kitsui_14.State)('collapsed');
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
        (0, kitsui_14.Component)()
            .style('profile-button-icon')
            .style.bind(isSimple, 'profile-button-icon--overlay')
            .style.bind(kitsui_14.State.Every(button, isSimple, button.hoveredOrHasFocused), 'profile-button-icon--overlay--hover')
            .appendToWhen(displayMode.notEquals('expanded'), button);
        (0, kitsui_14.Component)()
            .style('profile-button-border')
            .style.bind(displayMode.equals('simple'), 'profile-button-border--simple')
            .style.bind(button.hoveredOrHasFocused, 'profile-button-border--hover')
            .appendTo(button);
        (0, kitsui_14.Component)()
            .style('profile-button-name')
            .append((0, kitsui_14.Component)().style('profile-button-name-display').text.set(profile.name))
            .append((0, kitsui_14.Component)().style('profile-button-name-code').text.set(`#${profile.code}`))
            .appendTo(button);
        (0, kitsui_14.Component)()
            .style('profile-button-power')
            .style.toggle(profile.power > 200, 'profile-button-power--seasonal-bonus')
            .append(Icon_1.default.Power)
            .text.append(`${profile.power}${profile.power > 200 ? '+' : ''}`)
            .appendToWhen(displayMode.equals('expanded'), button);
        if (profile.clan?.callsign)
            (0, kitsui_14.Component)()
                .style('profile-button-clan-callsign')
                .text.set(`[${profile.clan.callsign}]`)
                .appendToWhen(displayMode.equals('collapsed'), button);
        if (profile.guardianRank)
            (0, kitsui_14.Component)()
                .style('profile-button-guardian-rank')
                .append((0, kitsui_14.Component)()
                .style('profile-button-guardian-rank-icon')
                .append((0, kitsui_14.Component)().style('profile-button-guardian-rank-icon-number').text.set(profile.guardianRank.rank.toString())))
                .append((0, kitsui_14.Component)().style('profile-button-guardian-rank-name').text.set(profile.guardianRank.name))
                .appendToWhen(displayMode.equals('expanded'), button);
        if (profile.clan?.name)
            (0, kitsui_14.Component)()
                .style('profile-button-clan-name')
                .text.set(profile.clan.name)
                .appendToWhen(displayMode.equals('expanded'), button);
        return button.extend(button => ({
            mode: displayMode,
        }));
    });
    exports.default = ProfileButton;
});
define("component/WordmarkLogo", ["require", "exports", "kitsui", "utility/Env"], function (require, exports, kitsui_15, Env_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Env_2 = __importDefault(Env_2);
    exports.default = (0, kitsui_15.Component)(component => {
        return component.style('wordmark-logo')
            .append((0, kitsui_15.Component)('img')
            .style('wordmark-logo-icon')
            .attributes.set('src', `${Env_2.default.ORIGIN}/static/logo.png`))
            .append((0, kitsui_15.Component)('img')
            .style('wordmark-logo-wordmark')
            .attributes.set('src', `${Env_2.default.ORIGIN}/static/wordmark.png`));
    });
});
define("component/Navbar", ["require", "exports", "component/core/Link", "component/profile/ProfileButton", "component/WordmarkLogo", "kitsui", "kitsui/component/Slot", "model/Profile"], function (require, exports, Link_1, ProfileButton_1, WordmarkLogo_1, kitsui_16, Slot_3, Profile_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Link_1 = __importDefault(Link_1);
    ProfileButton_1 = __importDefault(ProfileButton_1);
    WordmarkLogo_1 = __importDefault(WordmarkLogo_1);
    Slot_3 = __importDefault(Slot_3);
    Profile_1 = __importDefault(Profile_1);
    const Navbar = (0, kitsui_16.Component)('nav', (component) => {
        const visible = (0, kitsui_16.State)(false);
        const viewTransitionsEnabled = (0, kitsui_16.State)(false);
        const homeLinkState = (0, kitsui_16.State)('/');
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
                homeLinkState.bind(owner, kitsui_16.State.get(route));
                void owner.removed.await(navbar, true).then(() => {
                    if (homeLinkState.value === route || homeLinkState.value === '/')
                        homeLinkState.value = '/';
                });
                return navbar;
            },
        }))
            .appendToWhen(visible, kitsui_16.Component.getBody());
    });
    exports.default = Navbar;
});
define("component/Overlay", ["require", "exports", "kitsui"], function (require, exports, kitsui_17) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const visibleOverlays = new Set();
    const hasVisible = (0, kitsui_17.State)(false);
    const Overlay = Object.assign((0, kitsui_17.Component)((component, owner) => {
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
define("component/core/View", ["require", "exports", "component/DisplayBar", "component/Navbar", "component/Overlay", "kitsui", "kitsui/component/Loading", "kitsui/utility/Task", "utility/ViewTransition"], function (require, exports, DisplayBar_1, Navbar_1, Overlay_1, kitsui_18, Loading_1, Task_3, ViewTransition_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    DisplayBar_1 = __importDefault(DisplayBar_1);
    Navbar_1 = __importDefault(Navbar_1);
    Overlay_1 = __importDefault(Overlay_1);
    Loading_1 = __importDefault(Loading_1);
    Task_3 = __importDefault(Task_3);
    ViewTransition_2 = __importDefault(ViewTransition_2);
    const SYMBOL_VIEW_PARAMS = Symbol('VIEW_PARAMS');
    const ViewExt = kitsui_18.Component.Extension(view => view);
    let viewContainer;
    let navbar;
    let displayBar;
    function View(builder) {
        const hasNavbar = (0, kitsui_18.State)(true);
        const displayBarConfig = (0, kitsui_18.State)(undefined);
        return (0, kitsui_18.Component)((component, paramsIn) => {
            const id = Math.random().toString(36).slice(2);
            const params = (0, kitsui_18.State)(paramsIn);
            const view = component
                .and(ViewExt)
                .style('view')
                .extend(view => ({
                infoContainer: undefined,
                title: undefined,
                titleText: undefined,
                loading: undefined,
                hasNavbar,
                displayBarConfig,
                displayHandlers: displayBarConfig.map(view, config => config ? displayBar?.handlers : undefined),
                refresh: navigate.refresh,
                params,
                getNavbar() {
                    return navbar;
                },
            }))
                .extendJIT('infoContainer', view => (0, kitsui_18.Component)()
                .style('view-info-container')
                .prependTo(view))
                .extendJIT('title', view => (0, kitsui_18.Component)()
                .style('view-title')
                .viewTransitionSwipe(`view-title-${id}`)
                .prependTo(view.infoContainer))
                .extendJIT('titleText', view => view.title.text.rehost(view));
            let loading;
            let setLoadingApi;
            const loadingApiPromise = new Promise(resolve => setLoadingApi = resolve);
            let markLoadFinished;
            let markFinishResolved;
            const finishResolvedPromise = new Promise(resolve => markFinishResolved = resolve);
            view.extendJIT('loading', () => loading ??= Object.assign((0, Loading_1.default)().appendTo(view.infoContainer), {
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
                viewContainer ??= (0, kitsui_18.Component)()
                    .style('view-container')
                    .tweak(container => {
                    let savedScroll = 0;
                    Overlay_1.default.hasVisible.use(container, async (hasVisible) => {
                        if (hasVisible) {
                            savedScroll = document.documentElement.scrollTop;
                            document.documentElement.scrollTop = 0;
                            container.style('view-container--has-overlay')
                                .style.setVariable('overlay-scroll-margin-top', `${savedScroll}px`);
                            kitsui_18.Component.getDocument().style.removeVariables('overlay-scroll-margin-top');
                            return;
                        }
                        const overlayScrollTop = document.documentElement.scrollTop;
                        kitsui_18.Component.getDocument().style.setVariable('overlay-scroll-margin-top', `${-overlayScrollTop}px`);
                        document.documentElement.scrollTop = 0;
                        container.style.remove('view-container--has-overlay');
                        await Task_3.default.yield();
                        kitsui_18.Component.getDocument().style.setVariable('overlay-scroll-margin-top', `${savedScroll - overlayScrollTop}px`);
                        container.style.removeVariables('overlay-scroll-margin-top');
                        document.documentElement.scrollTop = savedScroll;
                    });
                })
                    .appendTo(document.body);
                view.appendTo(viewContainer);
                navbar ??= (0, Navbar_1.default)();
                displayBar ??= (0, DisplayBar_1.default)();
                displayBarConfig.emit();
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
define("component/display/filter/FilterAmmo", ["require", "exports", "component/display/Filter", "kitsui", "kitsui/utility/Arrays", "Relic"], function (require, exports, Filter_2, kitsui_19, Arrays_3, Relic_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Filter_2 = __importDefault(Filter_2);
    Relic_2 = __importDefault(Relic_2);
    const DestinyAmmoDefinition = kitsui_19.State.Async(kitsui_19.State.Owner.create(), async (signal, setProgress) => {
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
    exports.default = Filter_2.default.Definition({
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
                    chip.style.bindFrom(ammoType.map(chip, def => def && `filter-display-chip--ammo--${def.displayProperties.name.toLowerCase()}`));
                    chip.labelText.set(`${labelText}:`);
                    chip.text.set(filterText);
                },
                icon: ammoType.map(owner, def => def && `https://www.bungie.net${def.displayProperties.icon}`),
                filter(item, token) {
                    return !item.ammoType ? 'irrelevant'
                        : item.ammoType === ammoType.value?.hash;
                },
            };
        },
    });
});
define("component/display/filter/FilterBreakerType", ["require", "exports", "component/display/Filter", "kitsui", "kitsui/utility/Arrays", "Relic"], function (require, exports, Filter_3, kitsui_20, Arrays_4, Relic_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Filter_3 = __importDefault(Filter_3);
    Relic_3 = __importDefault(Relic_3);
    const defs = kitsui_20.State.Async(kitsui_20.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_3.default.connected;
        const [DestinyBreakerTypeDefinition, 
        // DeepsightBreakerSourceDefinition,
        DeepsightBreakerTypeDefinition,] = await Promise.all([
            conduit.definitions.en.DestinyBreakerTypeDefinition.all(),
            // conduit.definitions.en.DeepsightBreakerSourceDefinition.all(),
            conduit.definitions.en.DeepsightBreakerTypeDefinition.all(),
        ]);
        return {
            DestinyBreakerTypeDefinition,
            // DeepsightBreakerSourceDefinition,
            DeepsightBreakerTypeDefinition,
        };
    });
    const prefix = 'stun:';
    exports.default = Filter_3.default.Definition({
        id: 'stun',
        type: 'or',
        suggestions: defs.mapManual(defs => {
            return [prefix].concat(Object.values(defs?.DestinyBreakerTypeDefinition ?? {})
                .filter(Arrays_4.NonNullish)
                .map(def => def?.displayProperties?.name)
                .filter(name => !!name)
                .map(name => `${prefix}${name.toLowerCase()}`));
        }),
        match(owner, token) {
            if (!token.lowercase.startsWith(prefix))
                return undefined;
            const element = token.lowercase.slice(prefix.length).trim();
            const breakerType = defs.map(owner, defs => {
                const matches = Object.values(defs?.DestinyBreakerTypeDefinition ?? {})
                    .filter(def => def?.displayProperties?.name.toLowerCase().startsWith(element));
                return matches.length === 1 ? matches[0] : undefined;
            });
            const [labelText, filterText] = token.displayText.split(':');
            return {
                fullText: breakerType.map(owner, def => !def ? token.lowercase : `${prefix}${def.displayProperties.name.toLowerCase()}`),
                isPartial: false,
                chip(chip, token) {
                    chip.labelText.set(`${labelText}:`);
                    chip.text.set(filterText);
                },
                icon: breakerType.map(owner, def => def && `https://www.bungie.net${def.displayProperties.icon}`),
                filter(item, token) {
                    const { DeepsightBreakerTypeDefinition } = defs.value ?? {};
                    const types = [
                        ...DeepsightBreakerTypeDefinition?.[item.hash]?.types ?? [],
                        ...item.sockets.flatMap(s => s.plugs.flatMap(plugHash => DeepsightBreakerTypeDefinition?.[plugHash]?.types ?? [])),
                    ].distinct();
                    return !types.length ? 'irrelevant'
                        : !breakerType.value || types.includes(breakerType.value.hash);
                },
            };
        },
    });
});
define("component/display/filter/FilterElement", ["require", "exports", "component/display/Filter", "kitsui", "Relic"], function (require, exports, Filter_4, kitsui_21, Relic_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Filter_4 = __importDefault(Filter_4);
    Relic_4 = __importDefault(Relic_4);
    const DestinyDamageTypeDefinition = kitsui_21.State.Async(kitsui_21.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_4.default.connected;
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
    exports.default = Filter_4.default.Definition({
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
                    chip.style.bindFrom(damageType.map(chip, def => def && `filter-display-chip--element--${def.displayProperties.name.toLowerCase()}`));
                    chip.labelText.set(`${labelText}:`);
                    chip.text.set(filterText);
                },
                icon: damageType.map(owner, def => def && `https://www.bungie.net${def.displayProperties.icon}`),
                filter(item, token) {
                    return !item.damageTypeHashes?.length ? 'irrelevant'
                        : item.damageTypeHashes.includes(damageType.value?.hash ?? NaN);
                },
            };
        },
    });
});
define("component/display/filter/FilterRarity", ["require", "exports", "component/display/Filter", "kitsui", "Relic"], function (require, exports, Filter_5, kitsui_22, Relic_5) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Filter_5 = __importDefault(Filter_5);
    Relic_5 = __importDefault(Relic_5);
    const DeepsightTierTypeDefinition = kitsui_22.State.Async(kitsui_22.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_5.default.connected;
        return await conduit.definitions.en.DeepsightTierTypeDefinition.all();
    });
    const EngramIcon = kitsui_22.State.Async(kitsui_22.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_5.default.connected;
        const engramDef = await conduit.definitions.en.DestinyPresentationNodeDefinition.get(3175645083 /* PresentationNodeHashes.Engrams */);
        return `https://www.bungie.net${engramDef?.displayProperties?.icon}`;
    });
    const prefix = 'rarity:';
    const excludedTierTypes = [
        3772930460 /* ItemTierTypeHashes.BasicCurrency */,
        1801258597 /* ItemTierTypeHashes.BasicQuest */,
        2166136261 /* ItemTierTypeHashes.Invalid */,
    ];
    exports.default = Filter_5.default.Definition({
        id: 'rarity',
        type: 'or',
        suggestions: DeepsightTierTypeDefinition.mapManual(defs => {
            return Object.values(defs ?? {})
                .filter(def => !excludedTierTypes.includes(def.hash))
                .sort((a, b) => a.tierType - b.tierType)
                .map(def => def?.displayProperties?.name)
                .filter(name => !!name)
                .map(name => `${prefix}${name.toLowerCase()}`);
        }),
        match(owner, token) {
            if (!token.lowercase.startsWith(prefix))
                return undefined;
            const element = token.lowercase.slice(prefix.length).trim();
            const tierType = DeepsightTierTypeDefinition.map(owner, defs => {
                const matches = Object.values(defs ?? {})
                    .filter(def => def?.displayProperties?.name?.toLowerCase().startsWith(element));
                return matches.length === 1 ? matches[0] : undefined;
            });
            const [labelText, filterText] = token.displayText.split(':');
            return {
                fullText: tierType.map(owner, def => !def ? token.lowercase : `${prefix}${def.displayProperties.name?.toLowerCase()}`),
                isPartial: tierType.falsy,
                chip(chip, token) {
                    chip.style.bindFrom(tierType.map(chip, def => def && `filter-display-chip--rarity--${def.displayProperties.name?.toLowerCase()}`));
                    chip.labelText.set(`${labelText}:`);
                    chip.text.set(filterText);
                },
                icon: EngramIcon,
                filter(item, token) {
                    return item.rarity === tierType.value?.hash;
                },
            };
        },
    });
});
define("model/DisplayProperties", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var DisplayProperties;
    (function (DisplayProperties) {
        function icon(path) {
            if (path?.startsWith('http'))
                return path;
            if (path?.startsWith('./'))
                return `https://deepsight.gg${path.slice(1)}`;
            return path ? `https://www.bungie.net${path}` : undefined;
        }
        DisplayProperties.icon = icon;
    })(DisplayProperties || (DisplayProperties = {}));
    exports.default = DisplayProperties;
});
define("component/display/filter/FilterSource", ["require", "exports", "component/display/Filter", "kitsui", "model/DisplayProperties", "Relic"], function (require, exports, Filter_6, kitsui_23, DisplayProperties_1, Relic_6) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Filter_6 = __importDefault(Filter_6);
    DisplayProperties_1 = __importDefault(DisplayProperties_1);
    Relic_6 = __importDefault(Relic_6);
    const defs = kitsui_23.State.Async(kitsui_23.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_6.default.connected;
        const [DeepsightItemSourceDefinition, DestinyEventCardDefinition, DeepsightStats,] = await Promise.all([
            conduit.definitions.en.DeepsightItemSourceDefinition.all(),
            conduit.definitions.en.DestinyEventCardDefinition.all(),
            conduit.definitions.en.DeepsightStats.all(),
        ]);
        return { DeepsightItemSourceDefinition, DestinyEventCardDefinition, DeepsightStats };
    });
    const prefix = 'source:';
    exports.default = Filter_6.default.Definition({
        id: 'source',
        type: 'or',
        collapsed: {
            hint: 'display-bar/filter/collapsed/source',
            applies: prefix,
        },
        suggestions: defs.mapManual(defs => {
            const { DeepsightItemSourceDefinition, DestinyEventCardDefinition, DeepsightStats } = defs ?? {};
            return Object.values(DeepsightItemSourceDefinition ?? {})
                .filter(def => false
                // sources that are not related to events
                || !def.event
                // sources for current events
                || DeepsightStats?.activeEvent === def.event
                // sources representing upcoming events
                || new Date(DestinyEventCardDefinition?.[def.event]?.endTime ?? 0).getTime() > Date.now())
                .map(def => def?.displayProperties?.name)
                .filter(name => !!name)
                .map(name => `${prefix}${name?.toLowerCase()}`);
        }),
        match(owner, token) {
            if (!token.lowercase.startsWith(prefix))
                return undefined;
            const source = defs.map(owner, defs => {
                const element = token.lowercase.slice(prefix.length).trim().trimQuotes();
                const matches = Object.values(defs?.DeepsightItemSourceDefinition ?? {})
                    .filter(def => def?.displayProperties?.name?.toLowerCase().startsWith(element));
                return element.length < 5 && matches.length > 1 ? undefined : matches[0];
            });
            const [labelText, filterText] = token.displayText.split(':');
            return {
                fullText: source.map(owner, def => !def ? token.lowercase : `${prefix}${def.displayProperties.name?.toLowerCase()}`),
                isPartial: false,
                chip(chip, token) {
                    chip.labelText.set(`${labelText}:`);
                    chip.text.set(filterText);
                },
                icon: source.map(owner, def => def && DisplayProperties_1.default.icon(def.displayProperties.icon)),
                filter(item, token) {
                    return !item.sources?.some(source => source.type !== 'defined' || source.eventState !== 'unknown') ? 'irrelevant'
                        : !source.value || !!item.sources.some(itemSource => itemSource.type === 'defined' && itemSource.id === source.value?.hash);
                },
            };
        },
    });
});
define("component/display/filter/FilterWeaponFoundry", ["require", "exports", "component/display/Filter", "kitsui", "model/DisplayProperties", "Relic"], function (require, exports, Filter_7, kitsui_24, DisplayProperties_2, Relic_7) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Filter_7 = __importDefault(Filter_7);
    DisplayProperties_2 = __importDefault(DisplayProperties_2);
    Relic_7 = __importDefault(Relic_7);
    const DeepsightWeaponFoundryDefinition = kitsui_24.State.Async(kitsui_24.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_7.default.connected;
        return await conduit.definitions.en.DeepsightWeaponFoundryDefinition.all();
    });
    const prefix = 'foundry:';
    exports.default = Filter_7.default.Definition({
        id: 'foundry',
        type: 'or',
        collapsed: {
            hint: 'display-bar/filter/collapsed/foundry',
            applies: prefix,
        },
        suggestions: DeepsightWeaponFoundryDefinition.mapManual(defs => {
            return Object.values(defs ?? {})
                .map(def => def?.displayProperties?.name)
                .filter(name => !!name)
                .map(name => `${prefix}${name?.toLowerCase()}`);
        }),
        match(owner, token) {
            if (!token.lowercase.startsWith(prefix))
                return undefined;
            const foundry = DeepsightWeaponFoundryDefinition.map(owner, DeepsightWeaponFoundryDefinition => {
                const element = token.lowercase.slice(prefix.length).trim().trimQuotes();
                const matches = Object.values(DeepsightWeaponFoundryDefinition ?? {})
                    .filter(def => def?.displayProperties?.name?.toLowerCase().startsWith(element));
                return matches.length === 1 ? matches[0] : undefined;
            });
            const [labelText, filterText] = token.displayText.split(':');
            return {
                fullText: foundry.map(owner, def => !def ? token.lowercase : `${prefix}${def.displayProperties.name?.toLowerCase()}`),
                isPartial: foundry.falsy,
                chip(chip, token) {
                    chip.labelText.set(`${labelText}:`);
                    chip.text.set(filterText);
                },
                icon: {
                    image: foundry.map(owner, def => def && DisplayProperties_2.default.icon(def.displayProperties.icon)),
                    tweak: image => (image
                        .style.bind(foundry.map(image, def => def?.hash === 1000 /* FoundryHashes.SUROS */), 'filter-display-chip-icon-image--foundry--suros')
                        .style.bind(foundry.map(image, def => def?.hash === 1010 /* FoundryHashes.Daito */), 'filter-display-chip-icon-image--foundry--daito')),
                },
                filter(item, token) {
                    return !item.foundryHash ? 'irrelevant'
                        : item.foundryHash === foundry.value?.hash;
                },
            };
        },
    });
});
define("component/display/filter/FilterWeaponType", ["require", "exports", "component/display/Filter", "kitsui", "Relic"], function (require, exports, Filter_8, kitsui_25, Relic_8) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Filter_8 = __importDefault(Filter_8);
    Relic_8 = __importDefault(Relic_8);
    const DeepsightWeaponTypeDefinition = kitsui_25.State.Async(kitsui_25.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_8.default.connected;
        return await conduit.definitions.en.DeepsightWeaponTypeDefinition.all();
    });
    const prefix = 'type:';
    function getWeaponTypeDefinition(token) {
        const element = token.lowercase.slice(prefix.length).trim().trimQuotes();
        const matches = Object.values(DeepsightWeaponTypeDefinition.value ?? {})
            .filter(def => def?.displayProperties?.name.toLowerCase().startsWith(element));
        return matches.length === 1 ? matches[0] : undefined;
    }
    exports.default = Object.assign(Filter_8.default.Definition({
        id: 'type',
        type: 'or',
        collapsed: {
            hint: 'display-bar/filter/collapsed/type',
            applies: prefix,
        },
        suggestions: DeepsightWeaponTypeDefinition.mapManual(defs => {
            return Object.values(defs ?? {})
                .map(def => def?.displayProperties?.name)
                .filter(name => !!name)
                .map(name => `${prefix}${name.toLowerCase()}`);
        }),
        match(owner, token) {
            if (!token.lowercase.startsWith(prefix))
                return undefined;
            const weaponType = DeepsightWeaponTypeDefinition.map(owner, () => getWeaponTypeDefinition(token));
            const [labelText, filterText] = token.displayText.split(':');
            return {
                fullText: weaponType.map(owner, def => !def ? token.lowercase : `${prefix}${def.displayProperties.name.toLowerCase()}`),
                isPartial: weaponType.falsy,
                chip(chip, token) {
                    chip.labelText.set(`${labelText}:`);
                    chip.text.set(filterText);
                },
                doubleWidthIcon: true,
                icon: {
                    image: weaponType.map(owner, def => def && `https://www.bungie.net${def.displayProperties.icon}`),
                    tweak: image => (image
                        .style.bind(weaponType.map(image, def => def?.hash === 3317538576 /* ItemCategoryHashes.Bows */), 'filter-display-chip-icon-image--type--bow')
                        .style.bind(weaponType.map(image, def => def?.hash === 3871742104 /* ItemCategoryHashes.Glaives */), 'filter-display-chip-icon-image--type--glaive')),
                },
                filter(item, token) {
                    return !item.categoryHashes?.length ? 'irrelevant'
                        : item.categoryHashes.includes(weaponType.value?.hash ?? NaN);
                },
            };
        },
    }), {
        getWeaponTypeDefinition,
    });
});
define("component/display/filter/FilterWeaponFrame", ["require", "exports", "component/display/Filter", "component/display/filter/FilterWeaponType", "kitsui", "kitsui/utility/Arrays", "Relic"], function (require, exports, Filter_9, FilterWeaponType_1, kitsui_26, Arrays_5, Relic_9) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Filter_9 = __importDefault(Filter_9);
    FilterWeaponType_1 = __importDefault(FilterWeaponType_1);
    Relic_9 = __importDefault(Relic_9);
    const DeepsightWeaponFrameDefinition = kitsui_26.State.Async(kitsui_26.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_9.default.connected;
        return await conduit.definitions.en.DeepsightWeaponFrameDefinition.all();
    });
    const prefix = 'frame:';
    exports.default = Filter_9.default.Definition({
        id: 'frame',
        type: 'or',
        collapsed: (owner, currentFilter) => !currentFilter.some(filter => filter.id === FilterWeaponType_1.default.id) ? undefined : {
            hint: 'display-bar/filter/collapsed/frame',
            applies: prefix,
        },
        suggestions: (owner, currentFilter) => DeepsightWeaponFrameDefinition.map(owner, defs => {
            return Object.values(defs ?? {})
                .filter(def => currentFilter
                .map(filter => filter.id !== FilterWeaponType_1.default.id ? undefined : FilterWeaponType_1.default.getWeaponTypeDefinition(filter.token)?.hash)
                .filter(Arrays_5.NonNullish)
                .some(weaponTypeHash => def.weaponTypes.includes(weaponTypeHash)))
                .map(def => def?.displayProperties?.name)
                .filter(name => !!name)
                .map(name => `${prefix}${name.toLowerCase()}`);
        }),
        match(owner, token) {
            if (!token.lowercase.startsWith(prefix))
                return undefined;
            const element = token.lowercase.slice(prefix.length).trim().trimQuotes();
            const weaponFrameMatches = DeepsightWeaponFrameDefinition.map(owner, defs => {
                return Object.values(defs ?? {})
                    .filter(def => def?.displayProperties?.name.toLowerCase().startsWith(element));
            });
            const weaponFrameName = weaponFrameMatches.map(owner, matches => {
                const matchNames = matches.map(def => `${prefix}${def.displayProperties.name.toLowerCase()}`).distinct();
                return matchNames.length === 1 ? matchNames[0] : undefined;
            });
            const weaponFrameIcon = weaponFrameMatches.map(owner, matches => {
                return matches
                    .map(def => `https://www.bungie.net${def.displayProperties.icon}`)
                    .groupBy(icon => icon, instances => instances.length)
                    .sort((a, b) => b[1] - a[1])
                    .map(([icon]) => icon)
                    .at(0);
            });
            const noWeaponFrameMatches = weaponFrameMatches.map(owner, matches => matches.length === 0);
            const [labelText, filterText] = token.displayText.split(':');
            return {
                fullText: weaponFrameName.map(owner, name => name ?? token.lowercase),
                isPartial: noWeaponFrameMatches,
                chip(chip, token) {
                    chip.labelText.set(`${labelText}:`);
                    chip.text.set(filterText);
                },
                icon: weaponFrameIcon,
                filter(item, token) {
                    const plugs = item.sockets?.flatMap(socket => socket.plugs) ?? [];
                    return !plugs?.length ? 'irrelevant'
                        : weaponFrameMatches.value.some(match => plugs.includes(match.hash));
                },
            };
        },
    });
});
define("component/core/Paragraph", ["require", "exports", "kitsui"], function (require, exports, kitsui_27) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_27.Component)(component => {
        return component.style('paragraph');
    });
});
define("component/core/Lore", ["require", "exports", "component/core/Paragraph", "kitsui"], function (require, exports, Paragraph_1, kitsui_28) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Paragraph_1 = __importDefault(Paragraph_1);
    exports.default = (0, kitsui_28.Component)(component => component.and(Paragraph_1.default).style('lore'));
});
define("model/Item", ["require", "exports", "kitsui"], function (require, exports, kitsui_29) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ItemState = ItemState;
    function ItemState(owner, item, collections) {
        return kitsui_29.State.Map(owner, [kitsui_29.State.get(item), kitsui_29.State.get(collections)], (item, collections) => ItemState.resolve(item, collections));
    }
    (function (ItemState) {
        function resolve(item, collections) {
            return {
                definition: item && collections.items[item.is === 'item-instance' ? item.itemHash : item.hash],
                instance: item?.is === 'item-instance' ? item : undefined,
                collections,
            };
        }
        ItemState.resolve = resolve;
    })(ItemState || (exports.ItemState = ItemState = {}));
});
define("component/item/Power", ["require", "exports", "kitsui", "Relic"], function (require, exports, kitsui_30, Relic_10) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PowerState = void 0;
    Relic_10 = __importDefault(Relic_10);
    const prismaticIcon = kitsui_30.State.Async(kitsui_30.State.Owner.create(), async (signal, setProgress) => {
        const conduit = await Relic_10.default.connected;
        const loadoutIcon = await conduit.definitions.en.DestinyLoadoutIconDefinition.get(814121290);
        return loadoutIcon?.iconImagePath;
    });
    var PowerState;
    (function (PowerState) {
        function fromItemState(state) {
            if (kitsui_30.State.is(state))
                return state.mapManual(fromItemState);
            return {
                damageTypes: state.definition?.damageTypeHashes,
                collections: state.collections,
            };
        }
        PowerState.fromItemState = fromItemState;
    })(PowerState || (exports.PowerState = PowerState = {}));
    exports.default = (0, kitsui_30.Component)((component, state) => {
        component.style('power');
        const primaryDamageType = state.map(component, state => state.collections.damageTypes[state.damageTypes?.[0]]);
        const damageTypes = state.map(component, state => state.damageTypes, (a, b) => a?.toSorted().join(',') === b?.toSorted().join(','));
        function getDamageTypeName(damageType) {
            const def = damageType === undefined ? undefined : state.value.collections.damageTypes[damageType];
            return def?.displayProperties.name.toLowerCase();
        }
        (0, kitsui_30.Component)()
            .style('power-damage-icon')
            .tweak(wrapper => {
            wrapper.style.bindFrom(damageTypes.map(wrapper, damageTypes => damageTypes?.length !== 1 ? undefined : `power-damage-icon--solo-${getDamageTypeName(damageTypes[0])?.toLowerCase()}`));
            kitsui_30.State.Use(wrapper, { primaryDamageType, damageTypes, prismaticIcon }).use(wrapper, ({ damageTypes, prismaticIcon }) => {
                wrapper.removeContents();
                wrapper.style.remove('power-damage-icon--1', 'power-damage-icon--2', 'power-damage-icon--3');
                if (damageTypes?.length === 5) {
                    wrapper.style('power-damage-icon--1');
                    (0, kitsui_30.Component)()
                        .style('power-damage-icon-image', 'power-damage-icon-image--prismatic')
                        .style.bindVariable('power-damage-image', `url(https://www.bungie.net${prismaticIcon})`)
                        .appendTo(wrapper);
                    const gradientFixer = (0, kitsui_30.Component)()
                        .style('power-damage-icon-image-prismatic-gradient-fixer')
                        .appendTo(wrapper);
                    for (let i = 0; i < 4; i++)
                        (0, kitsui_30.Component)()
                            .style('power-damage-icon-image', 'power-damage-icon-image--prismatic')
                            .style.bindVariable('power-damage-image', `url(https://www.bungie.net${prismaticIcon})`)
                            .appendTo(gradientFixer);
                    return;
                }
                wrapper.style(`power-damage-icon--${damageTypes?.length ?? 1}`);
                for (const damageType of damageTypes ?? []) {
                    const def = state.value.collections.damageTypes[damageType];
                    const damageTypeName = def.displayProperties.name.toLowerCase();
                    (0, kitsui_30.Component)()
                        .style('power-damage-icon-image', `power-damage-icon-image--${damageTypeName}`)
                        .style.bindVariable('power-damage-image', `url(https://www.bungie.net${def.displayProperties.icon})`)
                        .appendTo(wrapper);
                }
            });
        })
            .appendToWhen(primaryDamageType.truthy, component);
        (0, kitsui_30.Component)()
            .style('power-power')
            .tweak(wrapper => {
            damageTypes.use(wrapper, (damageTypes = []) => {
                const single = damageTypes.length === 5 || damageTypes.length <= 1;
                wrapper.style.toggle(single, 'power-power--colour');
                wrapper.style.toggle(!single, 'power-power--gradient');
                const damageTypeColourVars = damageTypes
                    .map(type => state.value.collections.damageTypes[type]?.displayProperties.name.toLowerCase())
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
define("utility/TooltipManager", ["require", "exports", "kitsui"], function (require, exports, kitsui_31) {
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
                        if (kitsui_31.State.is(value))
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
                kitsui_31.State.Use(component, { focused: componentWithPopover.hoveredOrHasFocused, visible: componentWithPopover.popover.visible }).subscribe(component, ({ focused, visible }, { visible: oldVisible } = { focused: false, visible: false }) => {
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
define("component/tooltip/PlugTooltip", ["require", "exports", "component/core/DisplaySlot", "component/core/Icon", "component/core/Image", "component/item/Stats", "kitsui", "kitsui/component/Tooltip", "style/icons", "utility/TooltipManager"], function (require, exports, DisplaySlot_2, Icon_2, Image_2, Stats_1, kitsui_32, Tooltip_1, icons_2, TooltipManager_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PlugState = PlugState;
    DisplaySlot_2 = __importDefault(DisplaySlot_2);
    Icon_2 = __importDefault(Icon_2);
    Image_2 = __importDefault(Image_2);
    Stats_1 = __importStar(Stats_1);
    Tooltip_1 = __importDefault(Tooltip_1);
    TooltipManager_1 = __importDefault(TooltipManager_1);
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
    function PlugState(owner, plug, collections) {
        return kitsui_32.State.Map(owner, [kitsui_32.State.get(plug), kitsui_32.State.get(collections)], (plug, collections) => ({ plug, collections }));
    }
    (function (PlugState) {
        function resolve(plug, collections) {
            return { plug, collections };
        }
        PlugState.resolve = resolve;
    })(PlugState || (exports.PlugState = PlugState = {}));
    const PlugTooltip = (0, kitsui_32.Component)((component, state) => {
        const tooltip = component.as(Tooltip_1.default)
            .anchor.reset()
            .anchor.add('off right', 'sticky centre')
            .anchor.add('off left', 'sticky centre');
        ////////////////////////////////////
        //#region Header
        tooltip.header.style('item-tooltip-header', 'plug-tooltip-header');
        (0, kitsui_32.Component)()
            .style('item-tooltip-title')
            .text.bind(state.map(tooltip, ({ plug }) => plug.displayProperties.name))
            .appendTo(tooltip.header);
        (0, kitsui_32.Component)()
            .style('item-tooltip-subtitle')
            .append((0, kitsui_32.Component)()
            .style('item-tooltip-subtitle-type')
            .text.bind(state.map(tooltip, ({ plug }) => plug.type)))
            // .append(Component()
            // 	.style('item-tooltip-subtitle-rarity')
            // 	.text.bind(rarity.map(tooltip, rarity => rarity.displayProperties.name))
            // )
            .appendTo(tooltip.header);
        //#endregion
        ////////////////////////////////////
        tooltip.body.style('item-tooltip-body');
        (0, kitsui_32.Component)()
            .style('plug-tooltip-description')
            .append((0, kitsui_32.Component)()
            .style('plug-tooltip-description-content')
            .text.bind(state.map(tooltip, ({ plug }) => plug.displayProperties.description)))
            .appendTo(tooltip.body);
        (0, kitsui_32.Component)()
            .style('item-tooltip-stats', 'plug-tooltip-stats')
            .and(Stats_1.default, Stats_1.StatsState.fromPlugState(state))
            .tweak(stats => {
            stats.style.bind(stats.anyVisible.falsy, 'item-tooltip-stats--no-visible-stats');
            stats.appendToWhen(stats.hasStats, tooltip.body);
        });
        const clarity = state.map(component, ({ plug }) => plug.clarity);
        (0, DisplaySlot_2.default)().style('plug-tooltip-clarity').appendToWhen(clarity.truthy, tooltip.body).use(clarity, (slot, clarity) => {
            if (!clarity?.descriptions.length)
                return;
            (0, kitsui_32.Component)()
                .style('plug-tooltip-clarity-header')
                .append((0, Image_2.default)('https://avatars.githubusercontent.com/u/117947315?s=48&v=4').style('plug-tooltip-clarity-header-icon'))
                .append((0, kitsui_32.Component)().style('plug-tooltip-clarity-header-name').text.set('Clarity'))
                .text.append(' / Community Insights')
                .appendTo(slot);
            const clarityComponents = {
                icon: (component, data) => {
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
                    .append((0, kitsui_32.Component)().style('plug-tooltip-clarity-labelled-line-label').append(...ClarityChildren(data.label, data)))
                    .append((0, kitsui_32.Component)().style('plug-tooltip-clarity-labelled-line-value').append(...ClarityChildren(data.value, data)))),
                pve: (component, data) => (component
                    .style('plug-tooltip-clarity-pvevp', 'plug-tooltip-clarity-pve')
                    .prepend((0, kitsui_32.Component)().style('plug-tooltip-clarity-pvevp-label').text.set(quilt => quilt['plug-tooltip/clarity/label-pve']()))),
                pvp: (component, data) => (component
                    .style('plug-tooltip-clarity-pvevp', 'plug-tooltip-clarity-pvp')
                    .prepend((0, kitsui_32.Component)().style('plug-tooltip-clarity-pvevp-label').text.set(quilt => quilt['plug-tooltip/clarity/label-pvp']()))),
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
                return (0, kitsui_32.Component)()
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
    exports.default = (0, TooltipManager_1.default)(PlugTooltip, {
        states: {
            state: undefined,
        },
        update(states, plug) {
            states.updateState(plug);
        },
        build(states, tooltip, state) {
            state = kitsui_32.State.get(state);
            return tooltip.and(PlugTooltip, states.state ??= kitsui_32.State.Mutable(tooltip, state));
        },
        onHover(states, state) {
            const { plug } = kitsui_32.State.value(state);
            console.log(plug.displayProperties.name, plug);
        },
    });
});
define("component/item/Stats", ["require", "exports", "kitsui"], function (require, exports, kitsui_33) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StatsState = void 0;
    const STATS_FILTERED_OUT = new Set([
        4043523819 /* StatHashes.Impact */,
        1345609583 /* StatHashes.AimAssistance */,
        3555269338 /* StatHashes.Zoom */,
        2714457168 /* StatHashes.AirborneEffectiveness */,
        1931675084 /* StatHashes.AmmoGeneration */,
        2715839340 /* StatHashes.RecoilDirection */,
    ]);
    var StatsState;
    (function (StatsState) {
        function fromItemState(state) {
            if (kitsui_33.State.is(state))
                return state.mapManual(fromItemState);
            return {
                item: state.definition,
                collections: state.collections,
            };
        }
        StatsState.fromItemState = fromItemState;
        function fromPlugState(state) {
            if (kitsui_33.State.is(state))
                return state.mapManual(fromPlugState);
            return {
                item: state.plug,
                collections: state.collections,
            };
        }
        StatsState.fromPlugState = fromPlugState;
    })(StatsState || (exports.StatsState = StatsState = {}));
    const Stats = (0, kitsui_33.Component)((component, state, display) => {
        component.style('stats');
        const statsVisible = (0, kitsui_33.State)(false);
        const hasStats = (0, kitsui_33.State)(false);
        const isAbbreviated = (0, kitsui_33.State)(false);
        kitsui_33.State.Use(component, { state, isAbbreviated }, ({ state: { item, collections }, isAbbreviated }) => {
            component.removeContents();
            let _barStatsWrapper;
            let _numericStatsWrapper;
            const barStatsWrapper = () => _barStatsWrapper ??= (0, kitsui_33.Component)().style('stats-section').tweak(display?.tweakStatSection).prependTo(component);
            const numericStatsWrapper = () => _numericStatsWrapper ??= (0, kitsui_33.Component)().style('stats-section').tweak(display?.tweakStatSection).appendTo(component);
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
                (0, kitsui_33.Component)()
                    .style('stats-stat')
                    .append((0, kitsui_33.Component)()
                    .style('stats-stat-label')
                    .text.set(statName)
                    .tweak(display?.tweakStatLabel, def, stat))
                    .append(!stat.displayAsNumeric && (0, kitsui_33.Component)()
                    .style('stats-stat-bar')
                    .style.toggle(stat.value < 0, 'stats-stat-bar--negative')
                    .style.setVariable('stats-stat-bar-progress', stat.value / (stat.max ?? 100))
                    .tweak(display?.tweakStatBar, def, stat))
                    .append((0, kitsui_33.Component)()
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
define("model/ArmourSet", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = ArmourSet;
    function ArmourSet(owner, state) {
        return state.map(owner, ({ definition: item, collections }) => {
            const definition = item && collections.itemSets[item.itemSetHash];
            const perks = definition?.setPerks
                .sort((a, b) => a.requiredSetCount - b.requiredSetCount)
                .map(perk => ({ requiredSetCount: perk.requiredSetCount, definition: collections.perks[perk.sandboxPerkHash] }))
                .filter((perk) => !!perk.definition);
            return !definition ? undefined : {
                definition,
                perks: perks ?? [],
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
define("component/tooltip/ItemTooltip", ["require", "exports", "component/core/DisplaySlot", "component/core/Image", "component/core/Lore", "component/core/Paragraph", "component/item/Power", "component/item/Stats", "kitsui", "kitsui/component/Slot", "kitsui/component/Tooltip", "model/ArmourSet", "model/DisplayProperties", "utility/Categorisation", "utility/Objects", "utility/TooltipManager"], function (require, exports, DisplaySlot_3, Image_3, Lore_1, Paragraph_2, Power_1, Stats_2, kitsui_34, Slot_4, Tooltip_2, ArmourSet_1, DisplayProperties_3, Categorisation_1, Objects_1, TooltipManager_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    DisplaySlot_3 = __importDefault(DisplaySlot_3);
    Image_3 = __importDefault(Image_3);
    Lore_1 = __importDefault(Lore_1);
    Paragraph_2 = __importDefault(Paragraph_2);
    Power_1 = __importDefault(Power_1);
    Stats_2 = __importStar(Stats_2);
    Slot_4 = __importDefault(Slot_4);
    Tooltip_2 = __importDefault(Tooltip_2);
    ArmourSet_1 = __importDefault(ArmourSet_1);
    DisplayProperties_3 = __importDefault(DisplayProperties_3);
    Categorisation_1 = __importDefault(Categorisation_1);
    TooltipManager_2 = __importDefault(TooltipManager_2);
    const PLUG_ARCHETYPE_ICON_SEQUENCE = 0;
    const PLUG_ARCHETYPE_ICON_SEQUENCE_FRAME = 1;
    const ItemTooltip = (0, kitsui_34.Component)((component, state) => {
        const tooltip = component.as(Tooltip_2.default)
            .anchor.reset()
            .anchor.add('off right', 'sticky centre')
            .anchor.add('off left', 'sticky centre');
        const rarity = state.map(tooltip, ({ collections, definition }) => collections.rarities[definition.rarity]);
        const isCollections = state.map(tooltip, ({ instance }) => !instance?.id);
        tooltip.style.bindFrom(rarity.map(tooltip, rarity => `item-tooltip--${rarity.displayProperties.name.toLowerCase()}`));
        ////////////////////////////////////
        //#region Header
        tooltip.header.style('item-tooltip-header');
        (0, kitsui_34.Component)()
            .style('item-tooltip-title')
            .text.bind(state.map(tooltip, ({ definition }) => definition.displayProperties.name))
            .appendTo(tooltip.header);
        (0, kitsui_34.Component)()
            .style('item-tooltip-subtitle')
            .append((0, kitsui_34.Component)()
            .style('item-tooltip-subtitle-type')
            .text.bind(state.map(tooltip, ({ definition }) => definition.type)))
            .append((0, kitsui_34.Component)()
            .style('item-tooltip-subtitle-rarity')
            .text.bind(rarity.map(tooltip, rarity => rarity.displayProperties.name)))
            .appendTo(tooltip.header);
        ////////////////////////////////////
        //#region Watermark
        const moment = state.map(tooltip, ({ collections, definition }) => collections.moments.find(moment => moment.moment.hash === definition.momentHash));
        const featured = state.map(tooltip, ({ definition }) => definition.featured);
        (0, kitsui_34.Component)()
            .style('item-tooltip-watermark')
            .style.bind(featured, 'item-tooltip-watermark--featured')
            .style.bindVariable('item-watermark', moment.map(tooltip, moment => moment && `url(${DisplayProperties_3.default.icon(moment.moment.iconWatermark)}`))
            .appendTo(tooltip.header);
        const tier = state.map(tooltip, ({ instance }) => instance?.tier);
        (0, kitsui_34.Component)()
            .style('item-tooltip-watermark-tier')
            .style.bindFrom(tier.map(tooltip, tier => `item-tooltip-watermark-tier--${tier}`))
            .tweak(wrapper => {
            tier.use(wrapper, (tier = 0) => {
                wrapper.removeContents();
                for (let i = 0; i < tier; i++)
                    (0, kitsui_34.Component)()
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
        const primaryInfo = (0, kitsui_34.Component)()
            .style('item-tooltip-primary-info')
            .appendTo(tooltip.body);
        ////////////////////////////////////
        //#region Damage
        (0, Power_1.default)(state.map(primaryInfo, ({ definition, collections }) => ({ damageTypes: definition.damageTypeHashes, collections })))
            .style('item-tooltip-damage')
            .appendTo(primaryInfo);
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Secondary Type
        const ammo = state.map(tooltip, ({ definition, collections }) => collections.ammoTypes[definition.ammoType]);
        const archetype = state.map(tooltip, ({ definition, collections }) => {
            const socketPlugHash = definition.sockets.find(socket => socket.type === 'Intrinsic/ArmorArchetype')?.defaultPlugHash;
            return collections.plugs[socketPlugHash];
        });
        const secondaryType = kitsui_34.State.Map(tooltip, [archetype, ammo], (archetype, ammo) => {
            if (ammo?.displayProperties)
                return ammo.displayProperties;
            if (archetype?.displayProperties)
                return {
                    ...archetype.displayProperties,
                    icon: archetype.displayProperties.iconSequences?.[PLUG_ARCHETYPE_ICON_SEQUENCE]?.frames?.[PLUG_ARCHETYPE_ICON_SEQUENCE_FRAME]
                        ?? archetype.displayProperties.icon,
                };
        });
        (0, kitsui_34.Component)()
            .style('item-tooltip-type')
            .append((0, kitsui_34.Component)()
            .style('item-tooltip-type-icon')
            .style.bind(ammo.truthy, 'item-tooltip-type-icon--ammo')
            .style.bindVariable('item-tooltip-type-image', secondaryType.map(component, type => type && `url(https://www.bungie.net${type.icon})`)))
            .append((0, kitsui_34.Component)()
            .style('item-tooltip-type-label')
            .text.bind(secondaryType.map(component, type => type?.name)))
            .appendToWhen(secondaryType.truthy, primaryInfo);
        //#endregion
        ////////////////////////////////////
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Stats
        (0, kitsui_34.Component)()
            .style('item-tooltip-stats')
            .and(Stats_2.default, Stats_2.StatsState.fromItemState(state), { isAbbreviated: true })
            .tweak(stats => {
            stats.style.bind(stats.anyVisible.falsy, 'item-tooltip-stats--no-visible-stats');
            stats.appendToWhen(stats.hasStats, tooltip.body);
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Perks
        const perks = state.map(tooltip, ({ definition }) => definition.sockets.filter(socket => Categorisation_1.default.IsIntrinsicPerk(socket) || Categorisation_1.default.IsPerk(socket)));
        const itemSet = (0, ArmourSet_1.default)(tooltip, state);
        (0, kitsui_34.Component)()
            .style('item-tooltip-perks')
            .tweak(wrapper => {
            (0, Slot_4.default)().appendTo(wrapper).use(kitsui_34.State.Use(wrapper, { sockets: perks, itemSet, isCollections, state }), (slot, { sockets, itemSet, isCollections, state: { collections } }) => {
                ////////////////////////////////////
                //#region Socket component
                const Plugs = (socket) => socket.plugs
                    .map(plugHash => collections.plugs[plugHash])
                    .filter(plug => !!plug);
                const Socket = (0, kitsui_34.Component)((wrapper, socket, plugs, noSocketed) => {
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
                        (0, kitsui_34.Component)()
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
                        (0, kitsui_34.Component)()
                            .style('item-tooltip-perks-perk', 'item-tooltip-perks-perk--intrinsic')
                            .append((0, Image_3.default)(`https://www.bungie.net${perk.displayProperties.icon}`)
                            .style('item-tooltip-perks-perk-icon'))
                            .append((0, kitsui_34.Component)()
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
                    (0, kitsui_34.Component)()
                        .style('item-tooltip-perks-perk', 'item-tooltip-perks-perk--intrinsic')
                        .append((0, kitsui_34.Component)()
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
        const flavourText = state.map(tooltip, ({ definition }) => definition.flavorText);
        (0, kitsui_34.Component)()
            .style('item-tooltip-flavour-text-wrapper')
            .append((0, Lore_1.default)().style('item-tooltip-flavour-text').text.bind(flavourText))
            .appendToWhen(flavourText.truthy, tooltip.extra);
        ////////////////////////////////////
        //#region Sources
        const sourceList = (0, DisplaySlot_3.default)()
            .style('item-tooltip-source-list')
            .appendTo(tooltip.extra);
        sourceList.use(state, (slot, { definition, collections }) => {
            const sources = definition.sources;
            if (!sources?.length)
                return;
            const SourceWrapper = (0, kitsui_34.Component)((component, display) => {
                const icon = !display.icon ? undefined
                    : (0, Image_3.default)(DisplayProperties_3.default.icon(display.icon)).style('item-tooltip-source-icon');
                const title = (0, kitsui_34.Component)()
                    .style('item-tooltip-source-title')
                    .text.set(display.name);
                const subtitle = !display.subtitle ? undefined : (0, kitsui_34.Component)()
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
                        if (sourceRef.eventState === 'unknown')
                            return undefined;
                        const isUpcomingEvent = sourceRef.eventState === 'upcoming';
                        let subtitle = Objects_1._
                            ?? (source.category === 1 /* DeepsightItemSourceCategory.ActivityReward */ ? quilt => quilt['item-tooltip/source/type/activity-reward']() : undefined)
                            ?? (source.category === 2 /* DeepsightItemSourceCategory.EventReward */ ? quilt => quilt['item-tooltip/source/type/event-reward'](isUpcomingEvent) : undefined)
                            ?? (source.category === 4 /* DeepsightItemSourceCategory.EventVendor */ ? quilt => quilt['item-tooltip/source/type/event-vendor'](isUpcomingEvent) : undefined)
                            ?? (source.category === 9 /* DeepsightItemSourceCategory.SeasonPass */ ? quilt => quilt['item-tooltip/source/type/season-pass']() : undefined)
                            ?? (source.category === 0 /* DeepsightItemSourceCategory.Vendor */
                                ? quilt => quilt[source.rotates ? 'item-tooltip/source/type/vendor-rotation' : 'item-tooltip/source/type/vendor']()
                                : undefined);
                        if (source.displayProperties.subtitle) {
                            const baseSubtitle = subtitle;
                            subtitle = quilt => quilt['item-tooltip/source/subtitle'](displayProperties.subtitle, typeof baseSubtitle === 'function' ? baseSubtitle(quilt) : baseSubtitle);
                        }
                        const hasLore = !!source.displayProperties.subtitle && (false
                            || source.category === 6 /* DeepsightItemSourceCategory.ExoticMission */
                            || source.category === 8 /* DeepsightItemSourceCategory.Dungeon */
                            || source.category === 7 /* DeepsightItemSourceCategory.Raid */);
                        const icon = displayProperties.icon;
                        return {
                            name: displayProperties.name,
                            subtitle,
                            icon,
                            tweak: wrapper => (wrapper.subtitle
                                ?.style.toggle(hasLore, 'item-tooltip-source-subtitle--lore')),
                        };
                    }
                    case 'table': {
                        const table = collections.dropTables[sourceRef.id];
                        if (!table?.displayProperties?.name)
                            return undefined;
                        return {
                            name: table.displayProperties.name,
                            subtitle: table.type === 'bonus-focus'
                                ? quilt => table.typeDisplayProperties.name
                                    ? quilt['item-tooltip/source/subtitle'](table.typeDisplayProperties.name, quilt['item-tooltip/source/type/bonus-focus']())
                                    : quilt['item-tooltip/source/type/bonus-focus']()
                                : table.displayProperties.description,
                            icon: table.displayProperties.icon,
                            tweak: wrapper => {
                                if (table.type === 'raid' || table.type === 'dungeon')
                                    wrapper.subtitle?.style('item-tooltip-source-subtitle--lore');
                                const mainDropTableEntry = table.dropTable?.[definition.hash];
                                const realEncounters = (table.encounters ?? []).filter(encounter => !encounter.traversal);
                                const encountersDroppingItem = realEncounters
                                    .filter(encounter => mainDropTableEntry || encounter.dropTable?.[definition.hash]);
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
                                    (0, kitsui_34.Component)()
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
        (0, kitsui_34.Component)()
            .style('item-tooltip-armour-set-details')
            .tweak(details => details
            .append((0, kitsui_34.Component)()
            .style('item-tooltip-armour-set-details-title')
            .append((0, kitsui_34.Component)()
            .style('item-tooltip-armour-set-details-title-text')
            .text.bind(itemSet.map(details, itemSet => itemSet?.definition.displayProperties.name))))
            .append((0, DisplaySlot_3.default)().style('item-tooltip-armour-set-details-perk-list').use(itemSet, (slot, itemSet) => {
            if (!itemSet?.perks.length)
                return;
            for (const perk of itemSet.perks)
                (0, kitsui_34.Component)()
                    .style('item-tooltip-armour-set-details-perk')
                    .append((0, Image_3.default)(`https://www.bungie.net${perk.definition.displayProperties.icon}`)
                    .style('item-tooltip-armour-set-details-perk-icon'))
                    .append((0, kitsui_34.Component)()
                    .style('item-tooltip-armour-set-details-perk-label')
                    .append((0, kitsui_34.Component)()
                    .style('item-tooltip-armour-set-details-perk-label-title')
                    .text.set(perk.definition.displayProperties.name))
                    .append((0, kitsui_34.Component)()
                    .style('item-tooltip-armour-set-details-perk-label-separator')
                    .text.set('/'))
                    .append((0, kitsui_34.Component)()
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
        state.use(tooltip, () => tooltip.rect.markDirty());
        return tooltip;
    });
    exports.default = (0, TooltipManager_2.default)(ItemTooltip, {
        states: {
            state: undefined,
        },
        update(states, state) {
            states.updateState(state);
        },
        build(states, tooltip, state) {
            return tooltip.and(ItemTooltip, states.state ??= kitsui_34.State.Mutable(tooltip, state));
        },
        onHover(states, state) {
            const { definition } = kitsui_34.State.value(state);
            console.log(definition.displayProperties.name, state);
        },
    });
});
define("component/item/Item", ["require", "exports", "component/core/Button", "component/core/Image", "component/tooltip/ItemTooltip", "kitsui", "model/DisplayProperties"], function (require, exports, Button_4, Image_4, ItemTooltip_1, kitsui_35, DisplayProperties_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_4 = __importDefault(Button_4);
    Image_4 = __importDefault(Image_4);
    ItemTooltip_1 = __importDefault(ItemTooltip_1);
    DisplayProperties_4 = __importDefault(DisplayProperties_4);
    const Item = Object.assign((0, kitsui_35.Component)((component, state) => {
        state = kitsui_35.State.get(state);
        const masterworked = state.map(component, item => false);
        const featured = state.map(component, item => item.definition.featured);
        const rarity = state.map(component, ({ collections, definition }) => collections.rarities[definition.rarity]);
        component.and(Button_4.default);
        component.style('item');
        component.style.bindFrom(rarity.map(component, rarity => rarity && `item--${rarity.displayProperties.name.toLowerCase()}`));
        component.style.bind(masterworked, 'item--masterworked');
        (0, kitsui_35.Component)()
            .style('item-border')
            .style.bind(masterworked, 'item-border--masterworked')
            .appendTo(component);
        (0, kitsui_35.Component)()
            .style('item-image-background')
            .append((0, Image_4.default)(state.map(component, ({ definition }) => `https://www.bungie.net${definition.displayProperties.icon}`))
            .style('item-image'))
            .appendTo(component);
        const moment = state.map(component, ({ collections, definition }) => collections.moments.find(moment => moment.moment.hash === definition.momentHash));
        (0, kitsui_35.Component)()
            .style('item-watermark')
            .style.bind(featured, 'item-watermark--featured')
            .style.bindVariable('item-watermark', moment.map(component, moment => moment && `url(${DisplayProperties_4.default.icon(moment.moment.iconWatermark)}`))
            .appendTo(component);
        (0, kitsui_35.Component)()
            .style('item-border-glow')
            .style.bind(masterworked, 'item-border-glow--masterworked')
            .appendTo(component);
        ItemTooltip_1.default.apply(component, state);
        component.onRooted(() => component.event.subscribe('contextmenu', event => {
            event.preventDefault();
            if (!state.value.instance?.id)
                void navigate.toURL(`/collections/${state.value.definition.refNames.moment}/${state.value.definition.refNames.item}`);
            else
                throw new Error('Cannot navigate to an item instance view yet');
        }));
        return component.extend(itemComponent => ({
            state,
        }));
    }), {
        Tooltip: undefined,
    });
    exports.default = Item;
});
define("component/tooltip/GenericTooltip", ["require", "exports", "kitsui", "kitsui/component/Tooltip", "utility/TooltipManager"], function (require, exports, kitsui_36, Tooltip_3, TooltipManager_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Tooltip_3 = __importDefault(Tooltip_3);
    TooltipManager_3 = __importDefault(TooltipManager_3);
    const GenericTooltipBuilder = (0, kitsui_36.Component)((component) => {
        const tooltip = component.style('generic-tooltip').as(Tooltip_3.default).anchor.reset();
        tooltip.header.style('generic-tooltip-header');
        const title = (0, kitsui_36.Component)()
            .style('generic-tooltip-title')
            .appendTo(tooltip.header);
        tooltip.body.style('generic-tooltip-body');
        const description = (0, kitsui_36.Component)()
            .style('generic-tooltip-description')
            .appendTo(tooltip.body);
        return tooltip.extend(tooltip => ({
            title,
            titleText: title.text.rehost(tooltip),
            description,
            descriptionText: description.text.rehost(tooltip),
        }));
    });
    const GenericTooltip = (0, TooltipManager_3.default)(GenericTooltipBuilder, {
        states: {
            applicator: undefined,
        },
        update(states, applicator) {
            states.updateApplicator(applicator);
        },
        build(states, tooltip, applicator) {
            return tooltip.and(GenericTooltipBuilder).tweak(tooltip => {
                states.applicator ??= (0, kitsui_36.State)(applicator);
                states.applicator.use(tooltip, tooltip.tweak);
            });
        },
    });
    exports.default = GenericTooltip;
});
define("component/overlay/ItemOverlay", ["require", "exports", "component/core/Image", "component/core/Lore", "component/item/Item", "component/item/Power", "component/item/Stats", "component/tooltip/GenericTooltip", "component/tooltip/PlugTooltip", "kitsui", "kitsui/component/Slot", "kitsui/utility/InputBus", "model/ArmourSet", "model/DisplayProperties", "Relic", "utility/Categorisation"], function (require, exports, Image_5, Lore_2, Item_1, Power_2, Stats_3, GenericTooltip_1, PlugTooltip_1, kitsui_37, Slot_5, InputBus_2, ArmourSet_2, DisplayProperties_5, Relic_11, Categorisation_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Image_5 = __importDefault(Image_5);
    Lore_2 = __importDefault(Lore_2);
    Item_1 = __importDefault(Item_1);
    Power_2 = __importStar(Power_2);
    Stats_3 = __importStar(Stats_3);
    GenericTooltip_1 = __importDefault(GenericTooltip_1);
    PlugTooltip_1 = __importStar(PlugTooltip_1);
    Slot_5 = __importDefault(Slot_5);
    InputBus_2 = __importDefault(InputBus_2);
    ArmourSet_2 = __importDefault(ArmourSet_2);
    DisplayProperties_5 = __importDefault(DisplayProperties_5);
    Relic_11 = __importDefault(Relic_11);
    Categorisation_2 = __importDefault(Categorisation_2);
    const PowerStatDefinition = kitsui_37.State.Async(async () => {
        const conduit = await Relic_11.default.connected;
        return await conduit.definitions.en.DestinyStatDefinition.get(1935470627 /* StatHashes.Power */);
    });
    exports.default = (0, kitsui_37.Component)((component, intendedState) => {
        // preserve all the ui for the last item when the "intended" item is set to undefined
        const state = (0, kitsui_37.State)({ collections: intendedState.value.collections });
        intendedState.use(component, intendedState => state.value = {
            ...intendedState,
            definition: state.value.definition ?? intendedState?.definition,
        });
        const collections = intendedState.map(component, state => state.collections);
        const overlay = component.style('item-overlay');
        const background = (0, kitsui_37.Component)().style('item-overlay-background').appendTo(overlay);
        (0, Image_5.default)(state.map(overlay, state => state?.definition?.previewImage && `https://www.bungie.net${state.definition.previewImage}`))
            .style('item-overlay-image')
            .appendTo(background);
        const foundryImage = state.map(overlay, state => DisplayProperties_5.default.icon(state?.collections?.foundries[state.definition?.foundryHash]?.overlay));
        (0, Image_5.default)(foundryImage)
            .style('item-overlay-foundry')
            .appendTo(background);
        const mainColumn = (0, kitsui_37.Component)()
            .style('item-overlay-column-content')
            .appendTo((0, kitsui_37.Component)()
            .style('item-overlay-column', 'item-overlay-column--main')
            .appendTo(overlay));
        ////////////////////////////////////
        //#region Display
        (0, kitsui_37.Component)()
            .style('item-overlay-header')
            .append((0, Slot_5.default)().use(state, (_, state) => state?.definition
            && (0, Item_1.default)(state).style('item-overlay-icon')))
            .append((0, kitsui_37.Component)().style('item-overlay-title').text.bind(state.map(overlay, state => state?.definition?.displayProperties.name)))
            .append((0, kitsui_37.Component)().style('item-overlay-subtitle').text.bind(state.map(overlay, state => state?.definition?.type)))
            .appendTo(mainColumn);
        const flavourText = state.map(overlay, state => state?.definition?.flavorText);
        (0, Lore_2.default)()
            .style('item-overlay-lore')
            .text.bind(flavourText)
            .appendToWhen(flavourText.truthy, mainColumn);
        const SocketGroup = (0, kitsui_37.Component)((component, socket) => {
            component.style.bind(component.hoveredOrHasFocused, 'item-overlay-socket-group--hover');
            const def = typeof socket !== 'number'
                ? kitsui_37.State.get(socket)
                : state.map(component, state => state?.collections?.socketCategories?.[socket]);
            const header = (0, kitsui_37.Component)()
                .style('item-overlay-socket-group-header')
                .style.bind(component.hoveredOrHasFocused, 'item-overlay-socket-group-header--hover')
                .tweak(GenericTooltip_1.default.apply, tooltip => tooltip
                .titleText.bind(def.map(component, def => def?.displayProperties.name))
                .descriptionText.bind(def.map(component, def => def?.displayProperties.description)))
                .appendTo(component);
            const title = (0, kitsui_37.Component)()
                .style('item-overlay-socket-group-title')
                .text.bind(def.map(component, def => def?.displayProperties.name))
                .appendTo(header);
            const content = (0, kitsui_37.Component)()
                .style('item-overlay-socket-group-content')
                .style.bind(component.hoveredOrHasFocused, 'item-overlay-socket-group-content--hover')
                .appendTo(component);
            return component.style('item-overlay-socket-group').extend(group => ({
                header, title, content,
                titleText: title.text.rehost(group),
            }));
        });
        const ArmorSetPlugType = 'Intrinsic/ArmorSet';
        const Plug = (0, kitsui_37.Component)('button', (component, plug) => {
            const isPerk = Categorisation_2.default.IsPerk(plug) || Categorisation_2.default.IsOrigin(plug);
            const isFrame = Categorisation_2.default.IsFrame(plug);
            const isArmorSet = plug.type === ArmorSetPlugType;
            component.style('item-overlay-plug')
                .style.toggle(isPerk, 'item-overlay-plug--perk')
                .style.toggle(isFrame, 'item-overlay-plug--frame')
                .style.toggle(isArmorSet, 'item-overlay-plug--armorset')
                .style.bind(component.hoveredOrHasFocused, 'item-overlay-plug--hover');
            (0, kitsui_37.Component)()
                .style('item-overlay-plug-effect')
                .style.toggle(isPerk, 'item-overlay-plug-effect--perk')
                .style.toggle(isFrame, 'item-overlay-plug-effect--frame')
                .style.toggle(isArmorSet, 'item-overlay-plug-effect--armorset')
                .style.bind(component.hoveredOrHasFocused.map(component, hover => hover && isPerk), 'item-overlay-plug-effect--perk--hover')
                .style.bind(component.hoveredOrHasFocused.map(component, hover => hover && isFrame), 'item-overlay-plug-effect--frame--hover')
                .appendTo(component);
            (0, Image_5.default)(`https://www.bungie.net${plug.displayProperties.icon}`)
                .style('item-overlay-plug-icon')
                .appendTo(component);
            PlugTooltip_1.default.apply(component, collections.map(component, collections => PlugTooltip_1.PlugState.resolve(plug, collections)));
            return component;
        });
        const Socket = (0, kitsui_37.Component)((component, socket, collections) => {
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
        const isWeapon = state.map(component, state => !!state?.definition?.categoryHashes?.includes(1 /* ItemCategoryHashes.Weapon */));
        SocketGroup(4241085061 /* SocketCategoryHashes.WeaponPerks_CategoryStyle1 */)
            .tweak(group => (0, Slot_5.default)().appendTo(group.content).use(state, (slot, { definition, instance, collections }) => {
            const sockets = definition?.sockets.filter(Categorisation_2.default.IsPerk) ?? [];
            if (!instance?.id)
                for (let i = 0; i < sockets.length; i++) {
                    if (i)
                        (0, kitsui_37.Component)().style('item-overlay-socket-group-gap').appendTo(slot);
                    Socket(sockets[i], collections)
                        .appendTo(slot);
                }
        }))
            .appendToWhen(isWeapon, mainColumn);
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Intrinsic Traits
        (0, Slot_5.default)().appendTo(mainColumn).use(state, (slot, state) => {
            const sockets = state?.definition?.sockets.filter(Categorisation_2.default.IsIntrinsic) ?? [];
            if (!state || !sockets.length)
                return;
            const collections = state.collections;
            SocketGroup(3956125808 /* SocketCategoryHashes.IntrinsicTraits */)
                .tweak(group => {
                if (!state.instance?.id) {
                    for (let i = 0; i < sockets.length; i++) {
                        if (i)
                            (0, kitsui_37.Component)().style('item-overlay-socket-group-gap').appendTo(slot);
                        const plug = collections.plugs[sockets[i].defaultPlugHash ?? sockets[i].plugs[0]];
                        Socket(sockets[i], collections)
                            .style('item-overlay-socket--intrinsic')
                            .append(!Categorisation_2.default.IsFrame(sockets[i]) || !plug ? undefined : (0, kitsui_37.Component)()
                            .style('item-overlay-socket-display')
                            .append((0, kitsui_37.Component)()
                            .style('item-overlay-socket-display-name')
                            .text.set(plug.displayProperties.name))
                            .append((0, kitsui_37.Component)()
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
        const itemSet = (0, ArmourSet_2.default)(component, state);
        (0, Slot_5.default)().appendTo(mainColumn).use(itemSet, (slot, itemSet) => {
            if (!itemSet)
                return;
            return SocketGroup(itemSet.definition)
                .tweak(group => {
                for (let i = 0; i < itemSet.perks.length; i++) {
                    if (i)
                        (0, kitsui_37.Component)().style('item-overlay-socket-group-gap').appendTo(group.content);
                    const perk = itemSet.perks[i];
                    (0, kitsui_37.Component)()
                        .style('item-overlay-socket', 'item-overlay-socket--intrinsic')
                        .append(Plug({
                        is: 'plug',
                        hash: -1,
                        type: ArmorSetPlugType,
                        displayProperties: perk.definition.displayProperties,
                        enhanced: false,
                    }))
                        .append((0, kitsui_37.Component)()
                        .style('item-overlay-socket-display')
                        .append((0, kitsui_37.Component)()
                        .style('item-overlay-socket-display-name')
                        .text.set(perk.definition.displayProperties.name)
                        .append((0, kitsui_37.Component)()
                        .style('item-overlay-socket-armour-set-label-separator')
                        .text.set('/'))
                        .append((0, kitsui_37.Component)()
                        .style('item-overlay-socket-armour-set-label-requirement')
                        .text.set(quilt => quilt['item-tooltip/armour-set/perk-requirement'](perk.requiredSetCount, 5))))
                        .append((0, kitsui_37.Component)()
                        .style('item-overlay-socket-display-description')
                        .text.set(perk.definition.displayProperties.description)))
                        .appendTo(group.content);
                }
            });
        });
        //#endregion
        ////////////////////////////////////
        const sideColumn = (0, kitsui_37.Component)()
            .style('item-overlay-column-content', 'item-overlay-column-content--side')
            .appendTo((0, kitsui_37.Component)()
            .style('item-overlay-column', 'item-overlay-column--side')
            .appendTo(overlay));
        ////////////////////////////////////
        //#region Stats
        const ammo = state.map(overlay, ({ definition, collections }) => collections.ammoTypes[definition?.ammoType]);
        const stats = (0, Stats_3.default)(Stats_3.StatsState.fromItemState(state), {
            tweakStatLabel: (label, def) => (label
                .style('item-overlay-stats-stat-label')
                .tweak(GenericTooltip_1.default.apply, tooltip => tooltip
                .titleText.set(def.displayProperties.name)
                .descriptionText.set(def.displayProperties.description))),
            tweakStatSection: section => section.style('item-overlay-stats-stat-section'),
        });
        (0, kitsui_37.Component)()
            .style('item-overlay-stats-wrapper')
            .tweak(c => c.style.bind(c.hoveredOrHasFocused, 'item-overlay-stats-wrapper--hover'))
            .append((0, kitsui_37.Component)()
            .style('item-overlay-stats-primary')
            .append((0, kitsui_37.Component)()
            .style('item-overlay-stats-primary-power')
            .append((0, kitsui_37.Component)()
            .style('item-overlay-stats-primary-power-label')
            .text.bind(PowerStatDefinition.map(stats, def => def?.displayProperties.name)))
            .append((0, Power_2.default)(Power_2.PowerState.fromItemState(state))
            .style('item-overlay-stats-primary-power-display')))
            .appendWhen(ammo.truthy, (0, kitsui_37.Component)()
            .style('item-overlay-stats-primary-ammo')
            .append((0, Image_5.default)(ammo.mapManual(ammo => ammo && `https://www.bungie.net${ammo.displayProperties.icon}`))
            .style('item-overlay-stats-primary-ammo-icon'))
            .append((0, kitsui_37.Component)()
            .style('item-overlay-stats-primary-ammo-label')
            .text.bind(ammo.mapManual(ammo => ammo?.displayProperties.name)))))
            .appendWhen(stats.hasStats, stats
            .style('item-overlay-stats'))
            .appendTo(sideColumn);
        //#endregion
        ////////////////////////////////////
        InputBus_2.default.event.until(overlay, event => event.subscribe('Down', (_, event) => {
            if (event.use('Escape')) {
                if (!state.value.instance?.id)
                    void navigate.toURL('/collections');
                else
                    throw new Error('Cannot navigate out of an item instance view yet');
            }
        }));
        return overlay;
    });
});
define("component/core/Details", ["require", "exports", "kitsui"], function (require, exports, kitsui_38) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Details = (0, kitsui_38.Component)('details', (component) => {
        const open = (0, kitsui_38.State)(false);
        const manualOpenState = (0, kitsui_38.State)(false);
        const transitioning = (0, kitsui_38.State)(false);
        const summary = (0, kitsui_38.Component)('summary').style('details-summary');
        const content = (0, kitsui_38.Component)().style('details-content').style.bind(open, 'details-content--open');
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
define("component/view/collections/Moment", ["require", "exports", "component/core/Details", "component/core/Image", "component/core/Lore", "component/item/Item", "kitsui"], function (require, exports, Details_1, Image_6, Lore_3, Item_2, kitsui_39) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FILTER_CHANGING_CLASS = void 0;
    Details_1 = __importDefault(Details_1);
    Image_6 = __importDefault(Image_6);
    Lore_3 = __importDefault(Lore_3);
    Item_2 = __importDefault(Item_2);
    const MomentBucket = (0, kitsui_39.Component)((component) => {
        component.style('collections-view-moment-bucket');
        const title = (0, kitsui_39.Component)()
            .style('collections-view-moment-bucket-title')
            .appendTo(component);
        const content = (0, kitsui_39.Component)()
            .style('collections-view-moment-bucket-content')
            .appendTo(component);
        return component.extend(bucket => ({
            title,
            titleText: undefined,
            content,
        }))
            .extendJIT('titleText', bucket => bucket.title.text.rehost(bucket));
    });
    exports.FILTER_CHANGING_CLASS = 'collections-view-content--filter-changing';
    exports.default = (0, kitsui_39.Component)((component, { moment, buckets }, collections, display) => {
        display = kitsui_39.State.get(display);
        const filterText = display.map(component, display => display?.filter.filterText).delay(component, 10);
        return component.and(Details_1.default)
            .tweak(details => {
            details
                .style('collections-view-moment')
                .classes.bind(filterText.delayed, exports.FILTER_CHANGING_CLASS)
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
            .append(moment.iconWatermark && (0, kitsui_39.Component)()
            .style('collections-view-moment-icon', 'collections-view-moment-icon--watermark')
            .style.bind(details.open, 'collections-view-moment-icon--open')
            .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment-icon--hover')
            .style.setVariable('moment-watermark-icon', `url(https://www.bungie.net${moment.iconWatermark})`))
            .append(!moment.iconWatermark && moment.displayProperties.icon && (0, Image_6.default)(`https://www.bungie.net${moment.displayProperties.icon}`)
            .style('collections-view-moment-icon')
            .style.bind(details.open, 'collections-view-moment-icon--open')
            .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment-icon--hover'))
            .append((0, kitsui_39.Component)()
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
            const armourWarlock = armour.filter(item => item.classType === 2 /* DestinyClass.Warlock */);
            const armourTitan = armour.filter(item => item.classType === 0 /* DestinyClass.Titan */);
            const armourHunter = armour.filter(item => item.classType === 1 /* DestinyClass.Hunter */);
            const ItemFilterState = (item) => kitsui_39.State.Map(details, [display, filterText, details.manualOpenState, details.transitioning], (display, filterText, open, transitioning) => ({
                filterText,
                filterState: display?.filter.filter(item, false) ?? true,
                open: filterText ? false : open,
                transitioning,
            })).delay(details, 10);
            const itemFilterStates = [...weapons, ...armour].toMap(item => [item, ItemFilterState(item)]);
            const hasAnyItemFilteredIn = kitsui_39.State.Map(details, [...itemFilterStates.values()], (...states) => states.some(state => state.filterState));
            kitsui_39.State.Use(details, {
                filterText,
                hasAnyItemFilteredIn,
                delayed: kitsui_39.State.Delayed(details, { filterText, hasAnyItemFilteredIn }, 100),
            }).use(details, ({ filterText, hasAnyItemFilteredIn, delayed }) => {
                if (!filterText) {
                    details.open.value = details.manualOpenState.value;
                    return;
                }
                if (delayed.filterText && delayed.hasAnyItemFilteredIn && hasAnyItemFilteredIn)
                    details.open.value = true;
                else if (!hasAnyItemFilteredIn)
                    details.open.value = false;
            });
            void details.open.await(details, true).then(() => {
                (0, Lore_3.default)()
                    .style('collections-view-moment-lore')
                    .text.set(moment.displayProperties.description)
                    .appendTo(details.content);
                const bucketsWrapper = (0, kitsui_39.Component)()
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
                        const shouldShowItem = (0, kitsui_39.State)(false);
                        let wasOpen = false;
                        filterState.use(bucket, (state, old) => {
                            const newShouldShow = state.filterText ? state.filterState : state.open;
                            if (old?.open)
                                wasOpen = true;
                            else if (!state.open && !state.transitioning)
                                wasOpen = false;
                            shouldShowItem.value = newShouldShow || (!state.filterText && wasOpen && shouldShowItem.value);
                        });
                        void shouldShowItem.await(bucket, true).then(() => {
                            const itemComponent = (0, Item_2.default)({ definition: item, collections })
                                .classes.bind(filterState.delayed, exports.FILTER_CHANGING_CLASS);
                            Object.assign(itemComponent, { shouldShowItem, filterState });
                            filterText.use(itemComponent, () => {
                                itemComponent.rect.markDirty();
                                Item_2.default.Tooltip?.anchor.markDirty();
                            });
                            const ownIndex = items.indexOf(item);
                            const itemComponentToPositionAfter = bucket.content.getDescendants(Item_2.default).toArray().findLast(item => items.indexOf(item.state.value.definition) < ownIndex);
                            itemComponent.insertToWhen(shouldShowItem, bucket.content, 'after', itemComponentToPositionAfter?.parent);
                        });
                        filterStates.push(shouldShowItem);
                    }
                    const shouldShowBucket = kitsui_39.State.Some(details, ...filterStates);
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
define("utility/Async", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sleep = sleep;
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
define("utility/Time", ["require", "exports", "kitsui"], function (require, exports, kitsui_40) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Time;
    (function (Time) {
        Time.state = (0, kitsui_40.State)(Date.now() / 1000);
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
define("component/view/CollectionsView", ["require", "exports", "component/core/View", "component/display/filter/FilterAmmo", "component/display/filter/FilterBreakerType", "component/display/filter/FilterElement", "component/display/filter/FilterRarity", "component/display/filter/FilterSource", "component/display/filter/FilterWeaponFoundry", "component/display/filter/FilterWeaponFrame", "component/display/filter/FilterWeaponType", "component/DisplayBar", "component/Overlay", "component/overlay/ItemOverlay", "component/view/collections/Moment", "kitsui", "kitsui/component/Loading", "kitsui/component/Slot", "kitsui/utility/Task", "model/Item", "Relic", "utility/Async", "utility/Time"], function (require, exports, View_1, FilterAmmo_1, FilterBreakerType_1, FilterElement_1, FilterRarity_1, FilterSource_1, FilterWeaponFoundry_1, FilterWeaponFrame_1, FilterWeaponType_2, DisplayBar_2, Overlay_2, ItemOverlay_1, Moment_1, kitsui_41, Loading_2, Slot_6, Task_4, Item_3, Relic_12, Async_1, Time_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    View_1 = __importDefault(View_1);
    FilterAmmo_1 = __importDefault(FilterAmmo_1);
    FilterBreakerType_1 = __importDefault(FilterBreakerType_1);
    FilterElement_1 = __importDefault(FilterElement_1);
    FilterRarity_1 = __importDefault(FilterRarity_1);
    FilterSource_1 = __importDefault(FilterSource_1);
    FilterWeaponFoundry_1 = __importDefault(FilterWeaponFoundry_1);
    FilterWeaponFrame_1 = __importDefault(FilterWeaponFrame_1);
    FilterWeaponType_2 = __importDefault(FilterWeaponType_2);
    DisplayBar_2 = __importDefault(DisplayBar_2);
    Overlay_2 = __importDefault(Overlay_2);
    ItemOverlay_1 = __importDefault(ItemOverlay_1);
    Moment_1 = __importStar(Moment_1);
    Loading_2 = __importDefault(Loading_2);
    Slot_6 = __importDefault(Slot_6);
    Task_4 = __importDefault(Task_4);
    Relic_12 = __importDefault(Relic_12);
    Time_1 = __importDefault(Time_1);
    const COLLECTIONS_DISPLAY = DisplayBar_2.default.Config({
        id: 'collections',
        sortConfig: {},
        filterConfig: {
            id: 'collections',
            filters: [FilterElement_1.default, FilterAmmo_1.default, FilterBreakerType_1.default, FilterWeaponType_2.default, FilterWeaponFrame_1.default, FilterWeaponFoundry_1.default, FilterSource_1.default, FilterRarity_1.default],
            debounceTime: 500,
        },
    });
    const ActiveEvent = kitsui_41.State.Async(async () => {
        const conduit = await Relic_12.default.connected;
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
        view.displayBarConfig.value = COLLECTIONS_DISPLAY;
        view.style('collections-view')
            .style.bind(view.loading.loaded, 'collections-view--ready');
        const changingFilter = (0, kitsui_41.State)(false);
        view.title
            .style('collections-view-title')
            .text.set(quilt => quilt['view/collections/title']())
            .appendWhen(changingFilter, (0, Loading_2.default)().showForever().style('collections-view-title-loading'));
        const { signal, setProgress } = await view.loading.start();
        setProgress(null, quilt => quilt['view/collections/load/connecting']());
        const conduit = await Relic_12.default.connected;
        if (signal.aborted)
            return;
        setProgress(null, quilt => quilt['view/collections/load/fetching']());
        const collections = (0, kitsui_41.State)(await conduit.getCollections());
        if (signal.aborted)
            return;
        await view.loading.finish();
        collections.useManual(collections => console.log('Collections:', collections));
        const homeLinkURL = navigate.state.map(view, url => {
            const route = new URL(url).pathname;
            return route === '/collections' ? '/' : '/collections';
        });
        view.getNavbar()
            ?.overrideHomeLink(homeLinkURL, view);
        ////////////////////////////////////
        //#region Collections
        const filterText = (0, kitsui_41.State)(undefined);
        const filterTextSource = view.displayHandlers.map(view, display => display?.filter.filterText);
        filterText.value = filterTextSource.value;
        filterTextSource.subscribe(view, async (text) => {
            changingFilter.value = true;
            await Task_4.default.yield();
            // await ViewTransition.perform("subview", 'collections-content', async () => {
            filterText.value = text;
            while (view.element.getElementsByClassName(Moment_1.FILTER_CHANGING_CLASS).length)
                await (0, Async_1.sleep)(10);
            // }).finished
            changingFilter.value = false;
        });
        let isFirstSeason = true;
        let isFirstExpac = true;
        (0, Slot_6.default)().subviewTransition('collections-content').appendTo(view).use({ collections, ActiveEvent }, (slot, { collections, ActiveEvent }) => {
            ////////////////////////////////////
            //#region Active Event
            if (ActiveEvent) {
                const eventWrapper = (0, kitsui_41.Component)()
                    .style('collections-view-year', 'collections-view-year--event');
                const buckets = collections.moments
                    .flatMap(m => Object.entries(m.buckets))
                    .groupBy(([bucketHash]) => +bucketHash, bucketEntries => bucketEntries.map(([, bucket]) => bucket))
                    .toObject(([bucketHash, buckets]) => [bucketHash, {
                        items: (buckets
                            .flatMap(b => b.items)
                            .filter(itemHash => collections.items[itemHash]?.sources?.some(source => source.type === 'defined' && collections.sources[source.id]?.event === ActiveEvent.hash))),
                    }]);
                let moment = collections.moments.find(m => m.moment.event === ActiveEvent.hash);
                if (moment) {
                    for (const [bucketHash, bucket] of Object.entries(buckets)) {
                        const existingBucket = moment.buckets[+bucketHash] ??= { items: [] };
                        existingBucket.items = existingBucket.items.concat(bucket.items).distinct();
                    }
                }
                else {
                    moment = {
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
                }
                const momentComponent = (0, Moment_1.default)(moment, collections, view.displayHandlers).appendTo(eventWrapper);
                momentComponent.open.value = true;
                momentComponent.manualOpenState.value = true;
                if (ActiveEvent.endTime)
                    (0, kitsui_41.Component)()
                        .style('collections-view-moment-title-time-remaining')
                        .text.bind(Time_1.default.state.map(momentComponent, time => Math.floor(time / 60)).map(momentComponent, minute => {
                        const timeRemaining = (+ActiveEvent.endTime - minute * 60) * 1000;
                        return quilt => quilt['view/collections/event-ends'](Time_1.default.translateDuration(timeRemaining)(quilt));
                    }))
                        .appendTo(momentComponent.summary);
                const shouldShow = kitsui_41.State.Map(momentComponent, [momentComponent.open, filterText], (open, filterText) => open || !filterText);
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
                    yearWrapper = !year ? undefined : (0, kitsui_41.Component)()
                        .style('collections-view-year')
                        .append((0, kitsui_41.Component)()
                        .style('collections-view-year-label')
                        .text.set(quilt => quilt['view/collections/year'](year)));
                }
                const momentComponent = (0, Moment_1.default)(moment, collections, view.displayHandlers);
                if (moment.moment.expansion && isFirstExpac) {
                    isFirstExpac = false;
                    if (!filterText.value) {
                        momentComponent.open.value = true;
                        momentComponent.manualOpenState.value = true;
                    }
                }
                else if (moment.moment.season !== undefined && isFirstSeason) {
                    isFirstSeason = false;
                    if (!filterText.value) {
                        momentComponent.open.value = true;
                        momentComponent.manualOpenState.value = true;
                    }
                }
                const shouldShow = kitsui_41.State.Map(momentComponent, [momentComponent.open, filterText], (open, filterText) => open || !filterText);
                yearMomentVisibilityStates.push(shouldShow);
                momentComponent.appendToWhen(shouldShow, yearWrapper ?? slot);
            }
            handleYearWrapperEnd();
            function handleYearWrapperEnd() {
                if (!yearWrapper)
                    return;
                const momentVisibilityStates = yearMomentVisibilityStates.slice();
                yearMomentVisibilityStates = [];
                const shouldShow = kitsui_41.State.Map(yearWrapper, momentVisibilityStates, (...states) => states.includes(true));
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
        const overlayState = kitsui_41.State.Map(view, [view.params, collections, itemMap], (params, collections, itemMap) => {
            if (!params)
                return Item_3.ItemState.resolve(undefined, collections);
            const result = 'itemHash' in params
                ? { is: 'item-reference', hash: +params.itemHash }
                : 'itemName' in params
                    ? { is: 'item-reference', hash: itemMap.nameToHash[params.moment]?.[params.itemName] }
                    : undefined;
            if (result !== undefined) {
                view.loading.skipViewTransition();
                return Item_3.ItemState.resolve(result, collections);
            }
            return Item_3.ItemState.resolve(undefined, collections);
        });
        (0, Overlay_2.default)(view).bind(overlayState.map(view, s => !!s.definition)).and(ItemOverlay_1.default, overlayState);
        //#endregion
        ////////////////////////////////////
    });
});
define("component/core/Paginator", ["require", "exports", "component/core/Button", "component/core/DisplaySlot", "kitsui", "kitsui/component/Loading"], function (require, exports, Button_5, DisplaySlot_4, kitsui_42, Loading_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_5 = __importDefault(Button_5);
    DisplaySlot_4 = __importDefault(DisplaySlot_4);
    Loading_3 = __importDefault(Loading_3);
    const Paginator = (0, kitsui_42.Component)((component) => {
        const state = (0, kitsui_42.State)(undefined);
        const currentPage = (0, kitsui_42.State)(-1);
        const totalPages = (0, kitsui_42.State)(0);
        const isLastPage = kitsui_42.State.MapManual([currentPage, totalPages], (page, total) => page >= total - 1);
        const lastDirection = (0, kitsui_42.State)(1);
        const pageData = [];
        const pages = [];
        const hasPageData = (0, kitsui_42.State)(false);
        const loading = (0, kitsui_42.State)(false);
        const shouldDisplay = kitsui_42.State.MapManual([hasPageData, totalPages], (hasPageData, totalPages) => hasPageData && totalPages >= 1);
        (0, Loading_3.default)()
            .style('paginator-loading')
            .showForever()
            .appendToWhen(loading, component);
        const Page = (0, kitsui_42.Component)((pageComponent, page) => {
            pageData[page] ??= (0, kitsui_42.State)(undefined);
            return pageComponent.style('paginator-page')
                .and(DisplaySlot_4.default)
                .use(pageData[page], (slot, data) => {
                if (data === undefined)
                    return;
                if (pageComponent.removed.value)
                    return;
                hasPageData.value = true;
                loading.value = false;
                state.value?.init(component, slot, page, data);
            });
        });
        (0, Button_5.default)()
            .style('paginator-button', 'paginator-button-prev')
            .append((0, kitsui_42.Component)()
            .style('paginator-button-arrow', 'paginator-button-prev-arrow'))
            .bindDisabled(currentPage.equals(0), 'no previous pages')
            .event.subscribe('click', () => currentPage.value = Math.max(0, currentPage.value - 1))
            .appendToWhen(shouldDisplay, component);
        const pageContainer = (0, kitsui_42.Component)()
            .style('paginator-page-container')
            .style.bindVariable('direction', lastDirection)
            .appendToWhen(shouldDisplay, component);
        currentPage.subscribeManual((page, lastPage) => {
            if (!state.value)
                return;
            lastDirection.value = page > (lastPage ?? -1) ? 1 : -1;
            pageData[page] ??= kitsui_42.State.Async(component, async () => {
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
            .append((0, kitsui_42.Component)()
            .style('paginator-button-arrow', 'paginator-button-next-arrow'))
            .bindDisabled(isLastPage, 'no more pages')
            .event.subscribe('click', () => currentPage.value = Math.min(totalPages.value - 1, currentPage.value + 1))
            .appendToWhen(shouldDisplay, component);
        (0, DisplaySlot_4.default)()
            .style('paginator-display')
            .use(totalPages, (slot, totalPages) => {
            for (let i = 0; i < totalPages; i++) {
                (0, kitsui_42.Component)()
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
define("component/core/TabButton", ["require", "exports", "component/core/Button", "kitsui"], function (require, exports, Button_6, kitsui_43) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_6 = __importDefault(Button_6);
    const TabButton = (0, kitsui_43.Component)((component, active) => {
        const displayMode = (0, kitsui_43.State)('horizontal');
        return component.and(Button_6.default).style('tab-button')
            .style.bind(active, 'tab-button--active')
            .tweak(button => button
            .style.bind(button.disabled, 'button--disabled', 'tab-button--disabled')
            .style.bind(button.hoveredOrHasFocused, 'button--hover', 'tab-button--hover'))
            .append((0, kitsui_43.Component)()
            .style('tab-button-underline')
            .style.bind(displayMode.equals('vertical'), 'tab-button-underline--vertical')
            .style.bind(active, 'tab-button-underline--active'))
            .extend(tabButton => ({
            setDisplayMode(mode) {
                if (typeof mode === 'string')
                    displayMode.value = mode;
                else
                    displayMode.bind(tabButton, mode);
                return tabButton;
            },
        }));
    });
    exports.default = TabButton;
});
define("component/core/Tabinator", ["require", "exports", "component/core/Link", "component/core/TabButton", "kitsui"], function (require, exports, Link_2, TabButton_1, kitsui_44) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Link_2 = __importDefault(Link_2);
    TabButton_1 = __importDefault(TabButton_1);
    const Tabinator = (0, kitsui_44.Component)((component) => {
        // eslint-disable-next-line prefer-const
        let Tab;
        const displayMode = (0, kitsui_44.State)('horizontal');
        const hideWhenSingleTab = (0, kitsui_44.State)(false);
        const isSingleTab = kitsui_44.State.JIT(() => !!Tab && [...tabsWrapper.getChildren(Tab)].length <= 1);
        const header = (0, kitsui_44.Component)()
            .style('tabinator-header')
            .style.bind(displayMode.equals('vertical'), 'tabinator-header--vertical')
            .style.bind(kitsui_44.State.Every(component, hideWhenSingleTab, isSingleTab), 'tabinator-header--hidden')
            .appendTo(component);
        const tabsWrapper = (0, kitsui_44.Component)()
            .style('tabinator-header-sticky-wrapper')
            .style.bind(displayMode.equals('vertical'), 'tabinator-header-sticky-wrapper--vertical')
            .appendTo(header);
        const content = (0, kitsui_44.Component)()
            .style('tabinator-content')
            .appendTo(component);
        let watchingNavigation = false;
        const tabinatorId = Math.random().toString(36).slice(2);
        const tabinatorDirection = (0, kitsui_44.State)(-1);
        const defaultSelection = (0, kitsui_44.State)(undefined);
        const currentURL = (0, kitsui_44.State)(undefined);
        Tab = (0, kitsui_44.Component)((component, route) => {
            if ([...tabsWrapper.getChildren(Tab)].every(tab => !tab.selected.value))
                defaultSelection.value ??= component;
            const selected = (0, kitsui_44.State)(false);
            const isDefaultSelection = defaultSelection.equals(component);
            selected.bind(component, isDefaultSelection);
            const tabId = Math.random().toString(36).slice(2);
            const tabContent = (0, kitsui_44.Component)()
                .style('tabinator-tab-content')
                .style.bind(selected.falsy, 'tabinator-tab-content--hidden')
                .ariaRole('tabpanel')
                .setId(`tabinator-${tabinatorId}-content-${tabId}`)
                .attributes.bind(selected.falsy, 'inert')
                .appendTo(content);
            if (route)
                component = component.and(Link_2.default, route)
                    .tweak(link => link.overrideClick.value = false);
            const enabled = (0, kitsui_44.State)(true);
            return component
                .and(TabButton_1.default, selected)
                .style('tabinator-tab-button')
                .style.bind(displayMode.equals('vertical'), 'tabinator-tab-button--vertical')
                .setDisplayMode(displayMode)
                .bindDisabled(enabled.falsy, 'bindEnabled')
                .tweak(b => b.style.bind(b.disabled, 'button--disabled', 'tab-button--disabled', 'tabinator-tab-button--disabled'))
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
                if (route) {
                    watchNavigation();
                    kitsui_44.State.Use(component, { currentURL, route: kitsui_44.State.get(route) }, ({ currentURL, route }) => {
                        if (currentURL === route)
                            selectTab(component);
                    });
                }
                tab.event.subscribe('click', e => {
                    e.preventDefault();
                    selectTab(tab);
                    if (tab.is(Link_2.default))
                        navigate.setURL(tab.href.value);
                });
                isSingleTab.markDirty();
            })
                .appendTo(tabsWrapper);
        });
        return component
            .style('tabinator')
            .style.bind(displayMode.equals('vertical'), 'tabinator--vertical')
            .style.bindVariable('tabinator-direction', tabinatorDirection)
            .extend(tabinator => ({
            Tab,
            header,
            tabsWrapper,
            hideWhenSingleTab() {
                hideWhenSingleTab.value = true;
                return tabinator;
            },
            setDisplayMode(mode) {
                displayMode.value = mode;
                return tabinator;
            },
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
            const tabs = [...tabsWrapper.getDescendants(Tab)];
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
            if (definition.itemCategoryHashes?.includes(3726054802 /* ItemCategoryHashes.Patterns */))
                return quilt => quilt['view/data/component/item/pattern'](definition.itemTypeDisplayName);
            if (definition.itemCategoryHashes?.includes(3109687656 /* ItemCategoryHashes.Dummies */))
                return quilt => quilt['view/data/component/item/dummy'](definition.itemTypeDisplayName);
            return definition.itemTypeAndTierDisplayName;
        },
    });
});
define("component/view/data/component/DestinyLocationDefinition", ["require", "exports", "component/view/data/DataComponentHelper"], function (require, exports, DataComponentHelper_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    DataComponentHelper_3 = __importDefault(DataComponentHelper_3);
    exports.default = (0, DataComponentHelper_3.default)({
        getName(definition) {
            const singleName = getSingleDisplayProperties(definition)?.name;
            if (singleName)
                return singleName;
            const names = getDisplayProperties(definition).map(display => display.name);
            return !names.length ? undefined : quilt => quilt['view/data/component/shared/multi'](names[0]);
        },
        getDescription(definition) {
            return getSingleDisplayProperties(definition)?.description;
        },
        getIcon(definition) {
            return getDisplayProperties(definition).at(0)?.icon;
        },
    });
    function getDisplayProperties(definition) {
        return !definition.locationReleases ? [] : definition.locationReleases
            .filter(loc => loc.displayProperties.name)
            .map(loc => loc.displayProperties)
            .distinct(display => `name:${display.name} desc:${display.description} icon:${display.icon}`);
    }
    function getSingleDisplayProperties(definition) {
        const displays = getDisplayProperties(definition);
        return displays.length === 1 ? displays[0] : undefined;
    }
});
define("component/view/data/DataHelperRegistry", ["require", "exports", "component/view/data/component/ClarityDescriptions", "component/view/data/component/DestinyInventoryItemDefinition", "component/view/data/component/DestinyLocationDefinition"], function (require, exports, ClarityDescriptions_1, DestinyInventoryItemDefinition_1, DestinyLocationDefinition_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    ClarityDescriptions_1 = __importDefault(ClarityDescriptions_1);
    DestinyInventoryItemDefinition_1 = __importDefault(DestinyInventoryItemDefinition_1);
    DestinyLocationDefinition_1 = __importDefault(DestinyLocationDefinition_1);
    exports.default = {
        DestinyInventoryItemDefinition: DestinyInventoryItemDefinition_1.default,
        DestinyLocationDefinition: DestinyLocationDefinition_1.default,
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
                if (icon)
                    return DataHelper.resolveImagePath(icon, component) ?? DataHelper.FALLBACK_ICON;
            }
            return DataHelper.FALLBACK_ICON;
        }
        DataHelper.getIcon = getIcon;
        function resolveImagePath(url, component) {
            if (component?.startsWith('Destiny'))
                return url.startsWith('/') ? `https://www.bungie.net${url}`
                    : url.startsWith('./') ? `https://www.bungie.net${url.slice(1)}`
                        : url.startsWith('http') ? url
                            : undefined;
            if (!component || component?.startsWith('Deepsight'))
                return url.startsWith('/') ? `https://www.bungie.net${url}`
                    : url.startsWith('./') ? `https://deepsight.gg${url.slice(1)}`
                        : url.startsWith('http') ? url
                            : undefined;
            console.warn(`Unable to resolve image path for URL "${url}" and component "${component}"`);
            return undefined;
        }
        DataHelper.resolveImagePath = resolveImagePath;
        function getComponentProvider(component) {
            return component
                ?.replace(/([A-Z])/g, ' $1')
                .trimStart()
                .split(' ')
                .at(0);
        }
        DataHelper.getComponentProvider = getComponentProvider;
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
define("component/view/data/DataDefinitionButton", ["require", "exports", "component/core/Button", "component/core/Image", "component/view/data/DataHelper", "kitsui"], function (require, exports, Button_7, Image_7, DataHelper_1, kitsui_45) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_7 = __importDefault(Button_7);
    Image_7 = __importDefault(Image_7);
    DataHelper_1 = __importDefault(DataHelper_1);
    const DataDefinitionButton = (0, kitsui_45.Component)('a', (component) => component
        .and(Button_7.default)
        .style('data-view-definition-button')
        .extend(component => ({
        data: (0, kitsui_45.State)(undefined),
    }))
        .event.subscribe(['click', 'contextmenu'], e => {
        e.preventDefault();
        const url = e.host.attributes.get('href')?.value;
        if (url)
            void navigate.toURL(url);
        return false;
    })
        .tweak(button => {
        button.textWrapper.remove();
        button.attributes.bind('href', button.data.mapManual(data => !data ? undefined
            : !('hash' in data.definition)
                ? `/data/${data.component}/full`
                : `/data/${data.component}/${String(data.definition.hash)}`));
        const icon = button.data.mapManual(data => DataHelper_1.default.getIcon(data?.component, data?.definition));
        const title = button.data.mapManual(data => {
            if (data?.singleDefComponent)
                return DataHelper_1.default.getComponentName(data?.component, true);
            else
                return DataHelper_1.default.getTitle(data?.component, data?.definition);
        });
        const subtitle = button.data.mapManual(data => {
            if (data?.customSubtitle)
                return data.customSubtitle;
            if (data?.singleDefComponent)
                return DataHelper_1.default.getComponentProvider(data?.component);
            else
                return DataHelper_1.default.getSubtitle(data?.component, data?.definition);
        });
        (0, Image_7.default)(icon, DataHelper_1.default.FALLBACK_ICON)
            .style('data-view-definition-button-icon')
            .appendTo(button);
        (0, kitsui_45.Component)()
            .style('data-view-definition-button-title')
            .text.bind(title)
            .appendTo(button);
        (0, kitsui_45.Component)()
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
                const result = new Map();
                for (let i = 0; i < this.length; i++) {
                    const group = grouper(this[i], i, this);
                    let groupArray = result.get(group);
                    if (!groupArray)
                        result.set(group, groupArray = []);
                    groupArray.push(this[i]);
                }
                if (!mapper)
                    return Array.from(result.entries());
                return Array.from(result.entries()).map(([key, array]) => [key, mapper(array)]);
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
define("component/view/data/DataProvider", ["require", "exports", "kitsui", "Relic", "utility/Arrays", "utility/Objects"], function (require, exports, kitsui_46, Relic_13, Arrays_6, Objects_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Relic_13 = __importDefault(Relic_13);
    Arrays_6 = __importDefault(Arrays_6);
    function DataProvider(definition) {
        const cachedData = [];
        const prepCache = [];
        function getInternal(...params) {
            return {
                params,
                data: kitsui_46.State.Async(kitsui_46.State.Owner.create(), async (signal, setProgress) => {
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
            clear() {
                cachedData.length = 0;
                prepCache.length = 0;
            },
        };
    }
    (function (DataProvider) {
        DataProvider.SINGLE = DataProvider({
            provider: async ([component, hash], signal, setProgress) => {
                const conduit = await Relic_13.default.connected;
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
                    const conduit = await Relic_13.default.connected;
                    if (signal.aborted)
                        return undefined;
                    const lowercaseComponent = component.toLowerCase();
                    if (filtersObj?.componentNameContains?.length && !filtersObj.componentNameContains.some(namePart => lowercaseComponent.includes(namePart.toLowerCase())))
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
                    const conduit = await Relic_13.default.connected;
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
                if (token.startsWith('table:')) {
                    Arrays_6.default.resolve(filter.componentNameContains ??= []).push(token.substring(6));
                    continue;
                }
                if (token.startsWith('deep:')) {
                    Arrays_6.default.resolve(filter.deepContains ??= []).push(token.substring(5));
                    continue;
                }
                if (token.startsWith('$')) {
                    Arrays_6.default.resolve(filter.jsonPathExpression ??= []).push(token);
                    continue;
                }
                Arrays_6.default.resolve(filter.nameContainsOrHashIs ??= []).push(token);
            }
            return filter;
        }
        DataProvider.createDefinitionsFilter = createDefinitionsFilter;
    })(DataProvider || (DataProvider = {}));
    exports.default = DataProvider;
});
define("component/overlay/DataOverlay", ["require", "exports", "component/core/Details", "component/core/DisplaySlot", "component/core/Image", "component/core/Link", "component/core/Paginator", "component/core/Tabinator", "component/view/data/DataDefinitionButton", "component/view/data/DataHelper", "component/view/data/DataProvider", "kitsui", "kitsui/component/Loading", "kitsui/component/Slot", "kitsui/utility/InputBus", "kitsui/utility/Task", "utility/Arrays"], function (require, exports, Details_2, DisplaySlot_5, Image_8, Link_3, Paginator_1, Tabinator_1, DataDefinitionButton_1, DataHelper_2, DataProvider_1, kitsui_47, Loading_4, Slot_7, InputBus_3, Task_5, Arrays_7) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Details_2 = __importDefault(Details_2);
    DisplaySlot_5 = __importDefault(DisplaySlot_5);
    Image_8 = __importDefault(Image_8);
    Link_3 = __importDefault(Link_3);
    Paginator_1 = __importDefault(Paginator_1);
    Tabinator_1 = __importDefault(Tabinator_1);
    DataDefinitionButton_1 = __importDefault(DataDefinitionButton_1);
    DataHelper_2 = __importDefault(DataHelper_2);
    DataProvider_1 = __importDefault(DataProvider_1);
    Loading_4 = __importDefault(Loading_4);
    Slot_7 = __importDefault(Slot_7);
    InputBus_3 = __importDefault(InputBus_3);
    Task_5 = __importDefault(Task_5);
    Arrays_7 = __importDefault(Arrays_7);
    exports.default = (0, kitsui_47.Component)((component, params) => {
        component.style('data-overlay');
        const dedupedParams = params.delay(component, 10, params => params, (a, b) => true
            && a?.table === b?.table
            && a?.hash === b?.hash
            && a?.definition === b?.definition
            && a?.links === b?.links);
        const links = dedupedParams.map(component, (params) => {
            return resolveLinks(params?.links);
        });
        function resolveLinks(links) {
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
        }
        const JSONRender = (0, kitsui_47.Component)((component, value, links) => {
            links ??= (0, kitsui_47.State)(undefined);
            ////////////////////////////////////
            //#region JSON
            const JSONComponent = kitsui_47.Component.Tag();
            const JSONPunctuation = (0, kitsui_47.Component)((component, punctuationString) => component.and(JSONComponent)
                .style('data-overlay-json-punctuation')
                .text.set(punctuationString));
            const JSONPlaceholder = (0, kitsui_47.Component)((component, text) => component.and(JSONComponent)
                .style('data-overlay-json-placeholder')
                .text.set(text));
            ////////////////////////////////////
            //#region Copypaste
            const JSONCopyPaste = (0, kitsui_47.Component)((component, value) => component.and(JSONComponent)
                .style('data-overlay-json-copypaste')
                .attributes.set('contenteditable', 'true')
                .attributes.set('aria-readonly', 'true')
                .tweak(input => {
                const string = `${value}`;
                input.element.textContent = string;
                input.style.setVariable('chars', string.length);
            })
                .event.subscribe('beforeinput', e => e.preventDefault())
                .event.subscribe('mousedown', e => {
                const input = e.host;
                if (document.activeElement !== input.element) {
                    void Task_5.default.yield().then(() => {
                        const range = document.createRange();
                        range.selectNodeContents(input.element);
                        const selection = window.getSelection();
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                    });
                }
            })
                .event.subscribe('blur', e => {
                window.getSelection()?.removeAllRanges();
            }));
            const JSONContainer = (0, kitsui_47.Component)((component, key, value, path, holdIn, isSoloKey = false) => {
                const pathString = path.join('/');
                const highlighted = navigate.hash.map(component, hash => hash.startsWith(`#${pathString}`));
                const keyString = typeof key !== 'object' ? `${key}` : undefined;
                let container;
                const keyComponent = (0, kitsui_47.Component)('a')
                    .setOwner(component)
                    .style('data-overlay-json-container-entry-key')
                    .attributes.set('href', `#${pathString}`)
                    .append(...typeof key === 'object' ? Arrays_7.default.resolve(key) : [])
                    .text.append(keyString ?? '')
                    .event.subscribe('click', e => {
                    if (e.targetComponent?.is(JSONCopyPaste))
                        return;
                    e.preventDefault();
                    container.open.value = !container.open.value;
                });
                const hold = (0, kitsui_47.State)(false);
                if (holdIn)
                    hold.bind(component, holdIn);
                if (highlighted.value)
                    hold.value = false;
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
                        .style.bind(details.open, 'data-overlay-json-container-entry-summary--open')
                        .append(!expandable && keyString && JSONLinks(keyString, path, '')
                        .style('data-overlay-json-container-entry-key-links', 'data-overlay-json-container-entry-key-links--pre'))
                        .append((0, kitsui_47.Component)()
                        .style('data-overlay-json-container-entry-inline')
                        .append(keyComponent)
                        .append(JSONPunctuation(':').style('data-overlay-json-container-entry-punctuation'))
                        .text.append(' ')
                        .append(expandable ? undefined : valueComponent)
                        .append(!expandable ? undefined : (expandable.is(JSONObject)
                        ? JSONPlaceholder(`{} ${expandable.size} ${expandable.size === 1 ? 'entry' : 'entries'}`)
                        : JSONPlaceholder(`[] ${expandable.length} ${expandable.length === 1 ? 'item' : 'items'}`)))
                        .append(expandable && keyString && JSONLinks(keyString, path)
                        .style('data-overlay-json-container-entry-key-links', 'data-overlay-json-container-entry-key-links--inline')))
                        .event.subscribe('click', e => {
                        if (e.targetComponent?.is(JSONCopyPaste))
                            e.preventDefault();
                    });
                    details.content
                        .append((0, kitsui_47.Component)()
                        .style('data-overlay-json-container-expandable')
                        .append(expandable));
                }))
                    .onRooted(() => {
                    if (isSoloKey || path.at(-1) === 'displayProperties')
                        container.open.value = true;
                    highlighted.use(keyComponent, highlighted => {
                        if (!highlighted)
                            return;
                        container.key.style('data-overlay-json-container-entry-key--highlighted');
                        container.open.value = true;
                        const highlightedContainers = container.getAncestorComponents(JSONContainer).toArray();
                        for (const ancestorContainer of highlightedContainers) {
                            ancestorContainer.key.style('data-overlay-json-container-entry-key--highlighted');
                            ancestorContainer.open.value = true;
                        }
                        highlightedContainers.push(container);
                        const jsonRoot = container.getAncestorComponents(JSONComponent).toArray().at(-1);
                        for (const container of jsonRoot?.getDescendants(JSONContainer) ?? []) {
                            if (highlightedContainers.includes(container))
                                continue;
                            container.open.value = false;
                            container.key.style.remove('data-overlay-json-container-entry-key--highlighted');
                        }
                    });
                })
                    .extend(container => ({
                    key: keyComponent,
                    path,
                }));
            });
            const JSONObject = (0, kitsui_47.Component)((component, object, path, hold) => {
                component.style('data-overlay-json', 'data-overlay-json-object');
                const entries = Object.entries(object);
                const isDisplayProperties = ['name', 'description', 'icon', 'hasIcon'].every(prop => prop in object);
                const displayPropertiesOrder = ['name', 'description'];
                if (isDisplayProperties)
                    entries.sort(([a], [b]) => {
                        const aIndex = displayPropertiesOrder.indexOf(a) + 1 || Infinity;
                        const bIndex = displayPropertiesOrder.indexOf(b) + 1 || Infinity;
                        return aIndex - bIndex;
                    });
                if ('displayProperties' in object || 'hash' in object)
                    entries.sort(([a], [b]) => 0
                        || ([
                            'hash', 'index', 'displayProperties',
                            // inv items:
                            'itemTypeAndTierDisplayName', 'flavorText', 'screenshot',
                            'itemType', 'itemSubType', 'specialItemType',
                            'classType',
                            'defaultDamageType',
                            'itemCategoryHashes',
                            // vendors:
                            'itemList',
                            'displayCategories',
                        ]
                            .map(key => +(b === key) - +(a === key))
                            .find(result => result !== 0))
                        || 0);
                for (const [key, value] of entries) {
                    JSONContainer(key, value, [...path ?? [], key], hold, entries.length === 1)
                        .tweak(container => container.key.style('data-overlay-json-object-key'))
                        .appendTo(component);
                }
                return component.and(JSONComponent).extend(obj => ({
                    size: entries.length,
                }));
            });
            const JSONArray = (0, kitsui_47.Component)((component, array, path, hold) => {
                component.style('data-overlay-json', 'data-overlay-json-array');
                JSONCascade(array.map((_, i) => i), path, hold, i => JSONContainer([JSONPunctuation('['), JSONNumber(i), JSONPunctuation(']')], array[i], [...path ?? [], i], hold, array.length === 1)
                    .tweak(container => container.key.style('data-overlay-json-array-index')))
                    .appendTo(component);
                return component.and(JSONComponent).extend(arr => ({
                    length: array.length,
                }));
            });
            //#endregion
            ////////////////////////////////////
            ////////////////////////////////////
            //#region Cascade
            const JSONCascade = (array, path, hold, init) => {
                const CASCADE_SIZE = 25;
                const chunks = array.groupBy((v, index) => Math.floor(index / CASCADE_SIZE)).map(([, chunk]) => chunk);
                if (chunks.length > CASCADE_SIZE)
                    return JSONCascade(chunks, path, hold, chunk => cascadeChunk(chunk));
                const result = (0, kitsui_47.Component)();
                if (chunks.length === 1) {
                    for (const item of chunks[0])
                        init(item).appendTo(result);
                    return result;
                }
                for (const chunk of chunks)
                    cascadeChunk(chunk)
                        .appendTo(result);
                return result;
                function cascadeChunk(chunk) {
                    const [start, end] = getEnds(chunk);
                    return (0, kitsui_47.Component)()
                        .style('data-overlay-json-container-entry')
                        .and(Details_2.default)
                        .tweak(details => {
                        const pathBeforeKey = path?.join('/');
                        const highlighted = navigate.hash.map(component, hash => {
                            if (!pathBeforeKey)
                                return false;
                            if (!hash.startsWith(`#${pathBeforeKey}`))
                                return false;
                            const nextSegment = hash.slice(pathBeforeKey.length + 2).split('/')[0];
                            const nextKey = isNaN(+nextSegment) ? nextSegment : +nextSegment;
                            return containsKey(chunk, nextKey);
                        });
                        details.summary
                            .style('data-overlay-json-container-entry-summary')
                            .style.bind(details.open, 'data-overlay-json-container-entry-summary--open')
                            .append((0, kitsui_47.Component)()
                            .style('data-overlay-json-container-entry-key')
                            .style.bind(highlighted, 'data-overlay-json-container-entry-key--highlighted')
                            .append(JSONPunctuation('['), JSONValue(start), JSONPunctuation('..'), JSONValue(end), JSONPunctuation(']')));
                        const expandable = (0, kitsui_47.Component)()
                            .style('data-overlay-json-container-expandable')
                            .appendTo(details.content);
                        const openedOnce = (0, kitsui_47.State)(false);
                        kitsui_47.State.Every(details, details.open, openedOnce.falsy).use(details, open => {
                            if (!open)
                                return;
                            openedOnce.value = true;
                            for (const item of chunk)
                                init(item).appendTo(expandable);
                        });
                        highlighted.use(details, highlighted => {
                            if (!highlighted)
                                return;
                            details.open.value = highlighted;
                        });
                    });
                }
                function getEnds(arr) {
                    return [getStart(arr), getEnd(arr)];
                    function getStart(arr) {
                        if (typeof arr[0] !== 'object')
                            return arr[0] ?? '???';
                        return getStart(arr[0]);
                    }
                    function getEnd(arr) {
                        const last = arr.at(-1);
                        if (typeof last !== 'object')
                            return last ?? '???';
                        return getEnd(last);
                    }
                }
                function containsKey(arr, key) {
                    if (typeof arr[0] !== 'object')
                        return arr.includes(key);
                    return arr.some(subArr => containsKey(subArr, key));
                }
            };
            //#endregion
            ////////////////////////////////////
            ////////////////////////////////////
            //#region Literals
            const JSONString = (0, kitsui_47.Component)((component, string) => component.and(JSONComponent)
                .style('data-overlay-json', 'data-overlay-json-string')
                .append(JSONPunctuation('"'))
                .append(string && JSONCopyPaste(string).style('data-overlay-json-string-value'))
                .append(JSONPunctuation('"')));
            const JSONNumber = (0, kitsui_47.Component)((component, number, path) => component.and(JSONComponent)
                .style('data-overlay-json', 'data-overlay-json-number')
                .append(JSONCopyPaste(number))
                .append(JSONLinks(number, path)));
            const JSONBool = (0, kitsui_47.Component)((component, bool) => component.and(JSONComponent)
                .style('data-overlay-json', 'data-overlay-json-boolean')
                .text.set(bool ? 'true' : 'false'));
            const JSONNull = (0, kitsui_47.Component)(component => component.and(JSONComponent)
                .style('data-overlay-json', 'data-overlay-json-null')
                .text.set('null'));
            //#endregion
            ////////////////////////////////////
            ////////////////////////////////////
            //#region Image
            const imageRegex = /^(?:\/|\.\/|https?:\/\/).*?\.(?:png|gif|jpg|jpeg)$/;
            const JSONImage = (0, kitsui_47.Component)((component, url) => component.and(JSONComponent)
                .style('data-overlay-json', 'data-overlay-json-image')
                .event.subscribeCapture('mousedown', e => {
                if (e.targetComponent === e.host) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            })
                .append(JSONString(url)
                .style('data-overlay-json-image-link'))
                .tweak(wrapper => {
                const preview = (0, kitsui_47.Component)()
                    .style('data-overlay-json-image-preview')
                    .appendTo(wrapper);
                const actualURL = DataHelper_2.default.resolveImagePath(url);
                const image = (0, Image_8.default)(actualURL, DataHelper_2.default.FALLBACK_ICON)
                    .style('data-overlay-json-image-preview-image');
                (0, kitsui_47.Component)('a')
                    .style('data-overlay-json-image-anchor')
                    .attributes.set('href', actualURL)
                    .attributes.set('target', '_blank')
                    .append(image)
                    .appendTo(preview);
                (0, kitsui_47.Component)()
                    .style('data-overlay-json-image-preview-metadata')
                    .append((0, kitsui_47.Component)()
                    .style('data-overlay-json-image-preview-metadata-number')
                    .text.bind(image.dimensions.map(preview, dimensions => `${dimensions?.width}`)))
                    .append(JSONPunctuation(' x '))
                    .append((0, kitsui_47.Component)()
                    .style('data-overlay-json-image-preview-metadata-number')
                    .text.bind(image.dimensions.map(preview, dimensions => `${dimensions?.height}`)))
                    .appendToWhen(image.dimensions.truthy, preview);
            }));
            //#endregion
            ////////////////////////////////////
            ////////////////////////////////////
            //#region Links
            const JSONLinks = (0, kitsui_47.Component)((component, key, path, leadingSpace = ' ') => component.and(DisplaySlot_5.default).use(links, (slot, links) => {
                if (!links)
                    return;
                const pathString = path?.join('.') ?? '';
                const { link } = links.links?.find(({ pathRegex }) => pathRegex.test(pathString)) ?? {};
                if (!link)
                    return;
                const ref = (0, kitsui_47.Component)()
                    .style('data-overlay-json-reference')
                    .appendTo(slot);
                if ('enum' in link) {
                    const enumDef = links.enums?.[link.enum];
                    ////////////////////////////////////
                    //#region Reference Enum
                    const enumMember = enumDef?.members.find(e => `${e.value}` === `${key}`);
                    if (enumDef && enumMember)
                        ref
                            .style('data-overlay-json-reference-enum')
                            .append(JSONPunctuation('enum'))
                            .text.append(' ')
                            .append((0, kitsui_47.Component)()
                            .style('data-overlay-json-reference-enum-name')
                            .text.set(enumDef.name))
                            .append(JSONPunctuation('.'))
                            .append((0, kitsui_47.Component)()
                            .style('data-overlay-json-reference-enum-member')
                            .text.set(enumMember.name));
                    //#endregion
                    ////////////////////////////////////
                    else if (enumDef?.bitmask) {
                        ////////////////////////////////////
                        //#region Reference Bitmask
                        const enumMembers = `${key}` === '0'
                            ? enumDef.members.filter(e => e.value === 0)
                            : enumDef.members.filter(e => (e.value & Number(key)) === e.value && e.value !== 0);
                        if (enumMembers.length > 0)
                            ref
                                .style('data-overlay-json-reference-enum')
                                .append(JSONPunctuation('bitmask'))
                                .text.append(' ')
                                .append((0, kitsui_47.Component)()
                                .style('data-overlay-json-reference-enum-name')
                                .text.set(enumDef.name))
                                .text.append(' ')
                                .append(JSONPunctuation('['))
                                .text.append(' ')
                                .append(...enumMembers.flatMap((e, i) => [
                                i && JSONPunctuation(' | '),
                                ((0, kitsui_47.Component)()
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
                    const linkedDef = defs?.[key];
                    DataProvider_1.default.SINGLE.prep(link.component, key);
                    if (linkedDef)
                        ref
                            .style('data-overlay-json-reference-definition')
                            .append((0, Link_3.default)(`/data/${link.component}/${key}`)
                            .style('data-overlay-json-reference-definition-link')
                            .append((0, kitsui_47.Component)()
                            .style('data-overlay-json-reference-label')
                            .text.set(DataHelper_2.default.getComponentName(link.component)))
                            .text.append(' "')
                            .append((0, kitsui_47.Component)()
                            .style('data-overlay-json-reference-definition-link-title')
                            .text.set(DataHelper_2.default.getTitle(link.component, linkedDef)))
                            .text.append('"'));
                    //#endregion
                    ////////////////////////////////////
                }
                if (ref.element.childNodes.length)
                    slot.prepend(JSONPunctuation(`${leadingSpace}// `));
            }));
            //#endregion
            ////////////////////////////////////
            const JSONValue = (value, path, hold) => {
                if (typeof value === 'string' && imageRegex.test(value))
                    return JSONImage(value);
                if (typeof value === 'string')
                    return JSONString(value);
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
            return JSONValue(value);
        });
        const dataTabs = (0, Tabinator_1.default)()
            .tweak(tabinator => tabinator.header.style('data-overlay-tabinator-header'))
            .appendTo(component);
        const jsonLink = params.map(component, (params) => `/data/${params?.table ?? ''}/${params?.hash ?? ''}`);
        const jsonTab = dataTabs.Tab(jsonLink)
            .bindEnabled(params.truthy)
            .text.set(quilt => quilt['view/data/overlay/tab/main']());
        params.use(component, params => {
            if (!params)
                jsonTab.select();
        });
        (0, Loading_4.default)()
            .showForever()
            .appendToWhen(params.map(component, p => !p?.definition), jsonTab.content);
        (0, Slot_7.default)()
            .use(params, (slot, params) => {
            if (!params)
                return;
            const defsTabs = (0, Tabinator_1.default)()
                .tweak(tabinator => tabinator.header.style('data-overlay-augmentations-tabinator-header'))
                .hideWhenSingleTab()
                .setDisplayMode('vertical')
                .appendTo(slot);
            const mainTab = defsTabs.Tab(jsonLink)
                .text.set(DataHelper_2.default.getComponentName(params.table));
            JSONRender(params.definition, links).appendTo(mainTab.content);
            for (const [augTable, augDef] of Object.entries(params.links?.augmentations ?? {})) {
                const augTab = defsTabs.Tab(`/data/${params.table}/${params.hash}/${augTable}`)
                    .text.set(DataHelper_2.default.getComponentName(augTable));
                const augLinks = DataProvider_1.default.SINGLE.get(augTable, params.hash).map(augTab, data => resolveLinks(data?.links));
                JSONRender(augDef, augLinks).appendTo(augTab.content);
            }
        })
            .appendTo(jsonTab.content);
        ////////////////////////////////////
        //#region Variants
        const variantsCount = params.map(component, params => params?.links?.variants?.length);
        const variantsLink = params.map(component, (params) => `/data/${params?.table ?? ''}/${params?.hash ?? ''}/variants`);
        const variantsTab = dataTabs.Tab(variantsLink)
            .text.bind(variantsCount.map(component, count => quilt => quilt['view/data/overlay/tab/variants'](count ?? 0)));
        variantsTab.appendToWhen(variantsCount.truthy, dataTabs.tabsWrapper);
        (0, DisplaySlot_5.default)()
            .style('data-view-definition-list')
            .use(dedupedParams, (slot, params) => {
            if (!params?.links?.variants?.length)
                return;
            for (const variant of params.links.variants) {
                const definition = params.links.definitions?.DestinyInventoryItemDefinition?.[variant.hash];
                if (!definition)
                    continue;
                DataProvider_1.default.SINGLE.prep('DestinyInventoryItemDefinition', variant.hash);
                (0, DataDefinitionButton_1.default)()
                    .tweak(button => button.data.value = {
                    component: 'DestinyInventoryItemDefinition',
                    definition,
                    customSubtitle: variant.type,
                })
                    .appendTo(slot);
            }
        })
            .appendTo(variantsTab.content);
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region References
        const referencesCount = (0, kitsui_47.State)(undefined);
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
                    const list = (0, kitsui_47.Component)()
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
        //#endregion
        ////////////////////////////////////
        InputBus_3.default.event.until(component, event => event.subscribe('Down', (_, event) => {
            if (event.use('Escape')) {
                void navigate.toURL('/data');
            }
        }));
        return component;
    });
});
define("component/view/DataView", ["require", "exports", "component/core/Button", "component/core/Details", "component/core/DisplaySlot", "component/core/Link", "component/core/Paginator", "component/core/TabButton", "component/core/View", "component/display/Filter", "component/DisplayBar", "component/Overlay", "component/overlay/DataOverlay", "component/view/data/DataDefinitionButton", "component/view/data/DataHelper", "component/view/data/DataProvider", "kitsui", "kitsui/component/Loading", "kitsui/component/Slot", "kitsui/utility/Arrays", "kitsui/utility/Functions", "lang", "Relic", "utility/Async", "utility/Objects", "utility/Time"], function (require, exports, Button_8, Details_3, DisplaySlot_6, Link_4, Paginator_2, TabButton_2, View_2, Filter_10, DisplayBar_3, Overlay_3, DataOverlay_1, DataDefinitionButton_2, DataHelper_3, DataProvider_2, kitsui_48, Loading_5, Slot_8, Arrays_8, Functions_1, lang_2, Relic_14, Async_2, Objects_4, Time_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_8 = __importDefault(Button_8);
    Details_3 = __importDefault(Details_3);
    DisplaySlot_6 = __importDefault(DisplaySlot_6);
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
    Loading_5 = __importDefault(Loading_5);
    Slot_8 = __importDefault(Slot_8);
    Functions_1 = __importDefault(Functions_1);
    lang_2 = __importDefault(lang_2);
    Relic_14 = __importDefault(Relic_14);
    Time_2 = __importDefault(Time_2);
    ////////////////////////////////////
    //#region Table Sort/Group Defs
    var CategoryId;
    (function (CategoryId) {
        CategoryId[CategoryId["Constants"] = 0] = "Constants";
    })(CategoryId || (CategoryId = {}));
    const PRIORITY_COMPONENTS = [
        'DestinyInventoryItemDefinition',
        'DestinySandboxPerkDefinition',
        'DestinyStatDefinition',
        'DestinyTraitDefinition',
        'DeepsightMomentDefinition',
        'DestinyVendorDefinition',
        'DestinyActivityDefinition',
        'DestinyActivityModifierDefinition',
        'DestinyRecordDefinition',
        'DestinyDestinationDefinition',
        'DestinyPlaceDefinition',
        CategoryId.Constants,
    ];
    const SINGLE_DEF_COMPONENTS = [
        'DeepsightStats',
        'DeepsightLinksDefinition',
        'DeepsightVariantDefinition',
    ];
    const HIDDEN_COMPONENTS = [
        'DestinyRewardSourceDefinition', // unused, completely empty
        'DestinyInventoryItemLiteDefinition',
        'DestinyBondDefinition', // has defs, but completely unused
        'DeepsightIconDefinition', // functionally augmentations, but links differently
    ];
    const COMPONENT_CATEGORIES = [
        {
            id: CategoryId.Constants,
            name: quilt => quilt['view/data/component/category/constants'](),
            components: ['DeepsightStats'],
            componentFilter: component => component.includes('Constants'),
        },
        {
            name: quilt => quilt['view/data/component/category/fireteam-finder'](),
            componentFilter: component => component.includes('FireteamFinder'),
        },
        {
            name: quilt => quilt['view/data/component/category/activity-skulls'](),
            componentFilter: component => component.includes('Activity') && component.includes('Skull'),
        },
        {
            name: quilt => quilt['view/data/component/category/loadouts'](),
            components: [
                'DestinyLoadoutNameDefinition',
                'DestinyLoadoutIconDefinition',
                'DestinyLoadoutColorDefinition',
            ],
        },
        {
            name: quilt => quilt['view/data/component/category/character-customisation'](),
            components: [
                'DestinyRaceDefinition',
                'DestinyGenderDefinition',
            ],
            componentFilter: component => component.includes('CharacterCustomization'),
        },
        {
            name: quilt => quilt['view/data/component/category/augmentations'](),
            componentFilter: (component, links) => Object.values(links?.components ?? {}).some(links => links.augmentations?.includes(component)),
        },
    ];
    const isSingleDefComponent = (componentName) => {
        return false
            || SINGLE_DEF_COMPONENTS.includes(componentName)
            || componentName.endsWith('ConstantsDefinition');
    };
    //#endregion
    ////////////////////////////////////
    ////////////////////////////////////
    //#region Filter UI Config
    const DATA_DISPLAY = DisplayBar_3.default.Config({
        id: 'data',
        filterConfig: {
            id: 'data-filter',
            allowUppercase: true,
            debounceTime: 500,
            filters: [],
            plaintextFilterTweakChip(chip, token) {
                if (token.lowercase.startsWith('deep:'))
                    token = Filter_10.FilterToken.create(token.slice(5));
                (0, Filter_10.PLAINTEXT_FILTER_TWEAK_CHIP)(chip, token);
            },
            plaintextFilterIsValid(token) {
                if (token.lowercase.startsWith('deep:'))
                    token = Filter_10.FilterToken.create(token.slice(5));
                return token.lowercase.length >= 3;
            },
        },
    });
    var Breadcrumb;
    (function (Breadcrumb) {
        function equals(a, b) {
            return a?.path === b?.path && getBreadcrumbName(a) === getBreadcrumbName(b);
        }
        Breadcrumb.equals = equals;
        function getBreadcrumbName(breadcrumb) {
            return Functions_1.default.resolve(breadcrumb?.name, lang_2.default)?.toString() ?? '';
        }
    })(Breadcrumb || (Breadcrumb = {}));
    const currentTime = (0, kitsui_48.State)(Date.now());
    setInterval(() => currentTime.value = Date.now(), 100);
    exports.default = (0, View_2.default)(async (view) => {
        view.style('data-view')
            .style.bind(view.loading.loaded, 'data-view--ready');
        view.title.text.set(quilt => quilt['view/data/title']());
        ////////////////////////////////////
        //#region Load
        const { signal, setProgress } = await view.loading.start();
        setProgress(null, quilt => quilt['view/data/load/connecting']());
        const conduit = await Relic_14.default.connected;
        if (signal.aborted)
            return;
        setProgress(null, quilt => quilt['view/data/load/fetching']());
        const lastCheck = (0, kitsui_48.State)(undefined);
        const state = kitsui_48.State.Async(view, async () => {
            lastCheck.value = undefined;
            const state = await conduit.checkUpdate();
            lastCheck.value = Date.now();
            return state;
        });
        // give just a bit of time to make sure that check update is the first set of requests that goes out from conduit
        await (0, Async_2.sleep)(10);
        if (signal.aborted)
            return;
        const componentNames = kitsui_48.State.Async(view, () => conduit.getComponentNames());
        const links = kitsui_48.State.Async(view, () => conduit.definitions.en.DeepsightLinksDefinition.all());
        // wait for the ones required for rendering
        await Promise.all([state.promise, componentNames.promise, links.promise]);
        if (signal.aborted)
            return;
        state.useManual(state => {
            if (!state?.version.updated)
                return;
            componentNames.refresh();
            links.refresh();
        });
        // when an update happened, list of components might be refreshing, so await it once more
        await componentNames.promise;
        if (signal.aborted)
            return;
        //#endregion
        ////////////////////////////////////
        await view.loading.finish();
        if (signal.aborted)
            return;
        ////////////////////////////////////
        //#region Versions & Update
        (0, Loading_5.default)()
            .style('data-view-versions')
            .setNormalTransitions()
            .tweak(wrapper => wrapper.set(state, (slot, currentState) => {
            currentState.version.deepsight = currentState.version.deepsight.length < 10
                ? currentState.version.deepsight
                // dev uses timestamps, compress it to base36 so it's easier to tell versions apart
                : (+currentState.version.deepsight).toString(36);
            const simplified = {
                ...currentState.version,
                destiny: currentState.version.destiny.split('.').at(-1),
                combined: undefined,
                updated: undefined,
            };
            (0, kitsui_48.Component)()
                .style('data-view-versions-text')
                .append((0, kitsui_48.Component)().style('data-view-versions-text-provider').text.set(quilt => quilt['view/data/versions/label']()), (0, kitsui_48.Component)().style('data-view-versions-text-punctuation').text.set(': '))
                .append(...Object.entries(simplified)
                .filter(([, version]) => version)
                .flatMap(([provider, version], i) => [
                i && (0, kitsui_48.Component)().style('data-view-versions-text-punctuation').text.set(' / '),
                (0, kitsui_48.Component)().style('data-view-versions-text-version').text.set(version),
            ])
                .filter(Arrays_8.Truthy))
                .appendToWhen(wrapper.hoveredOrHasFocused.falsy, slot);
            const full = {
                ...currentState.version,
                combined: undefined,
                updated: undefined,
            };
            (0, kitsui_48.Component)()
                .style('data-view-versions-text')
                .append(...Object.entries(full)
                .filter(([, version]) => version)
                .flatMap(([provider, version], i) => [
                i && (0, kitsui_48.Component)().style('data-view-versions-text-punctuation').text.set(' / '),
                (0, kitsui_48.Component)().style('data-view-versions-text-provider').text.set(provider),
                (0, kitsui_48.Component)().style('data-view-versions-text-punctuation').text.set(': '),
                (0, kitsui_48.Component)().style('data-view-versions-text-version').text.set(version),
            ])
                .filter(Arrays_8.Truthy))
                .appendToWhen(wrapper.hoveredOrHasFocused, slot);
            (0, kitsui_48.Component)()
                .style('data-view-versions-action-list')
                .append((0, Button_8.default)()
                .style('data-view-versions-action-button')
                .tweak(button => button
                .text.bind(kitsui_48.State.Map(slot, [currentTime, lastCheck, button.hoveredOrHasFocused], (elapsed, last, hovered) => quilt => quilt['view/data/versions/action/check'](!last || !hovered ? undefined : Time_2.default.relative(last, { components: 1 })))))
                .event.subscribe('click', () => state.refresh()))
                .appendTo(slot);
        }))
            .appendTo(view);
        //#endregion
        ////////////////////////////////////
        view.displayBarConfig.value = DATA_DISPLAY;
        const filterText = view.displayHandlers.map(view, display => display?.filter.filterText);
        componentNames.useManual(componentNames => console.log('Component Names:', componentNames));
        (0, Slot_8.default)()
            .use({ componentNames, links, filterText }, (slot, { componentNames, links, filterText }) => {
            if (!componentNames)
                return;
            ////////////////////////////////////
            //#region Group & Sort Tables
            componentNames = componentNames.filter(name => !HIDDEN_COMPONENTS.includes(name));
            const componentNameGroups = componentNames
                .groupBy((name, i) => {
                for (const category of COMPONENT_CATEGORIES) {
                    const isInCategory = false
                        || category.components?.includes(name)
                        || category.componentFilter?.(name, links);
                    if (!isInCategory)
                        continue;
                    return category;
                }
            })
                .filter((entry) => !!entry[0]);
            const indices = componentNames.toObject(name => [
                name,
                (Objects_4._
                    || PRIORITY_COMPONENTS.indexOf(name) + 1
                    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                    || PRIORITY_COMPONENTS.indexOf(componentNameGroups.find(([category, names]) => names.includes(name))?.[0].id) + 1
                    || Infinity),
            ]);
            componentNames.sort((a, b) => indices[a] - indices[b]);
            //#endregion
            ////////////////////////////////////
            const dataPageProvider = DataProvider_2.default.createPaged(filterText);
            const groupWrappers = new Map();
            // if (!filterText) {
            for (let i = 0; i < componentNames.length; i++) {
                const name = componentNames[i];
                ////////////////////////////////////
                //#region Category Wrapper
                const [category] = componentNameGroups.find(([category, names]) => names.includes(name)) ?? [];
                if (category && !groupWrappers.has(category)) {
                    const filteredIn = (0, kitsui_48.State)(false);
                    groupWrappers.set(category, {
                        details: (0, Details_3.default)()
                            .style('collections-view-moment', 'data-view-component-category')
                            .style.toggle(!!filterText, 'data-view-component-category--flat')
                            .viewTransitionSwipe(`data-view-component-${name}-category`)
                            .tweak(details => details
                            .style.bind(details.open, 'details--open', 'collections-view-moment--open')
                            .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment--hover'))
                            .tweak(details => details.summary
                            .style('collections-view-moment-summary', 'data-view-component-category-summary')
                            .style.toggle(!!filterText, 'data-view-component-category--flat-summary')
                            .style.bind(details.open, 'collections-view-moment-summary--open', 'data-view-component-category-summary--open')
                            .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment-summary--hover')
                            .text.set(category.name))
                            .tweak(details => details.content
                            .style('data-view-component-category-content')
                            .style.toggle(!!filterText, 'data-view-component-category--flat-content'))
                            .tweak(details => {
                            if (!filterText) {
                                details.appendTo(slot);
                                return;
                            }
                            details.appendToWhen(filteredIn, slot);
                            details.open.value = true;
                        }),
                        filteredIn,
                        filteredInStates: [],
                    });
                }
                //#endregion
                ////////////////////////////////////
                ////////////////////////////////////
                //#region Component Wrapper
                const categoryWrapper = groupWrappers.get(category);
                const details = (0, Details_3.default)()
                    .style('collections-view-moment')
                    .tweak(details => details
                    .style.bind(details.open, 'details--open', 'collections-view-moment--open')
                    .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment--hover'))
                    .viewTransitionSwipe(`data-view-component-${name}`);
                const filteredIn = (0, kitsui_48.State)(false);
                categoryWrapper?.filteredInStates.push(filteredIn);
                if (!filterText)
                    details.appendTo(categoryWrapper?.details.content ?? slot);
                else
                    details.appendToWhen(filteredIn, categoryWrapper?.details.content ?? slot);
                const augments = Object.values(links?.components ?? {}).find(links => links.augmentations?.includes(name))?.component;
                details.summary
                    .style('collections-view-moment-summary', 'data-view-component-summary')
                    .style.bind(details.open, 'collections-view-moment-summary--open')
                    .style.bind(details.summary.hoveredOrHasFocused, 'collections-view-moment-summary--hover')
                    .text.set(DataHelper_3.default.getComponentName(name))
                    .append(augments && (0, kitsui_48.Component)()
                    .style('data-view-component-summary-augments')
                    .text.set(quilt => quilt['view/data/component/shared/augments'](DataHelper_3.default.getComponentName(augments))));
                const openedOnce = (0, kitsui_48.State)(!!filterText);
                kitsui_48.State.Some(details, openedOnce, details.open).useManual(opened => {
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
                            const list = (0, kitsui_48.Component)()
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
                            if (isSingleDefComponent(name)) {
                                const keys = Object.keys(data.definitions);
                                const singleDef = keys.length > 1 || typeof data.definitions[keys[0]] !== 'object' || !data.definitions[keys[0]]
                                    ? data.definitions
                                    : data.definitions[keys[0]];
                                (0, DataDefinitionButton_2.default)()
                                    .tweak(button => button.data.value = { component: name, definition: singleDef, singleDefComponent: true })
                                    .appendTo(list);
                                return;
                            }
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
                //#endregion
                ////////////////////////////////////
            }
            // bind all group wrappers to base their filteredIn on their children's filteredIn
            for (const wrapper of groupWrappers.values()) {
                const filteredIn = kitsui_48.State.Map(wrapper.details, wrapper.filteredInStates, (...states) => states.some(v => v));
                wrapper.filteredIn.bind(wrapper.details, filteredIn);
            }
            return;
            // }
        })
            .appendTo(view);
        const breadcrumbs = (0, kitsui_48.State)([]);
        const homeLinkURL = navigate.state.map(view, url => {
            const route = new URL(url).pathname;
            return route === '/data' ? '/' : '/data';
        });
        view.getNavbar()
            ?.overrideHomeLink(homeLinkURL, view)
            .append((0, DisplaySlot_6.default)()
            ////////////////////////////////////
            //#region Tabs
            .style('data-view-breadcrumbs-wrapper')
            .setOwner(view)
            .use(breadcrumbs, (slot, crumbs) => {
            const wrapper = (0, kitsui_48.Component)()
                .style('data-view-breadcrumbs')
                .appendTo(slot);
            const navigatePath = navigate.state.map(slot, url => new URL(url).pathname);
            for (const breadcrumb of crumbs) {
                const componentName = breadcrumb.path.slice(6).split('/')[0];
                const selected = navigatePath.equals(breadcrumb.path);
                const isFullViewOrSingleDefComponent = breadcrumb.path.endsWith('/full') || isSingleDefComponent(componentName);
                const [breadcrumbTitle, breadcrumbSubtitle] = isFullViewOrSingleDefComponent
                    ? [DataHelper_3.default.getComponentName(componentName, true), DataHelper_3.default.getComponentProvider(componentName)]
                    : [breadcrumb.name, DataHelper_3.default.getComponentName(componentName, true)];
                (0, TabButton_2.default)(selected)
                    .and(Link_4.default, breadcrumb.path)
                    .style('data-view-breadcrumbs-button')
                    .text.set(breadcrumbTitle)
                    .append((0, kitsui_48.Component)()
                    .style('data-view-breadcrumbs-button-component')
                    .text.set(breadcrumbSubtitle))
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
        })
        //#endregion
        ////////////////////////////////////
        );
        ////////////////////////////////////
        //#region Data Overlay
        const overlayDefinition = kitsui_48.State.Async(view, view.params, async (params, signal, setProgress) => {
            if (!params)
                return undefined;
            const table = params.table;
            const result = params.hash !== 'full'
                ? DataProvider_2.default.SINGLE.get(table, params.hash)
                ////////////////////////////////////
                //#region Full Table Data
                : kitsui_48.State.Async(kitsui_48.State.Owner.fromSignal(signal), async () => {
                    const conduit = await Relic_14.default.connected;
                    if (signal.aborted)
                        return undefined;
                    const defs = await conduit.definitions.en[table].all();
                    if (signal.aborted)
                        return undefined;
                    if (!isSingleDefComponent(table))
                        return { definition: defs };
                    const keys = Object.keys(defs);
                    const key = keys[0];
                    const singleDef = keys.length > 1 || typeof defs[key] !== 'object' || !defs[key]
                        ? defs
                        : defs[key];
                    return { definition: singleDef };
                });
            //#endregion
            ////////////////////////////////////
            if (!result)
                return undefined;
            view.loading.skipViewTransition();
            await result.promise;
            if (signal.aborted || !result.value)
                return undefined;
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
        const hasPendingOverlayDefinition = kitsui_48.State.Every(view, view.params.truthy, overlayDefinition.settled.falsy);
        const shouldShowOverlay = kitsui_48.State.Some(view, overlayDefinition.truthy, hasPendingOverlayDefinition);
        (0, Overlay_3.default)(view).bind(shouldShowOverlay).and(DataOverlay_1.default, overlayDefinition);
        shouldShowOverlay.subscribeManual(show => {
            if (!show) {
                view.displayHandlers.value?.filter.reapplyFilterSearchParam();
            }
        });
        //#endregion
        ////////////////////////////////////
    });
});
define("component/core/Card", ["require", "exports", "component/core/Lore", "component/core/Paragraph", "kitsui"], function (require, exports, Lore_4, Paragraph_3, kitsui_49) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Lore_4 = __importDefault(Lore_4);
    Paragraph_3 = __importDefault(Paragraph_3);
    const Card = (0, kitsui_49.Component)((component) => {
        let header;
        const flush = (0, kitsui_49.State)(false);
        return component.style('card')
            .style.bind(flush, 'card--flush')
            .style.bind(kitsui_49.State.Every(component, flush, component.hoveredOrHasFocused), 'card--flush--hover')
            .extend(card => ({
            header: undefined,
            headerText: undefined,
            description: undefined,
            descriptionText: undefined,
            flush,
        }))
            .extendJIT('header', card => header ??= (0, kitsui_49.Component)()
            .style('card-header')
            .style.bind(flush, 'card-header--flush')
            .tweak(header => {
            const text = (0, kitsui_49.Component)().style('card-header-text').appendTo(header);
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
define("component/view/SplashView", ["require", "exports", "component/core/Button", "component/core/Card", "component/core/DisplaySlot", "component/core/Link", "component/core/View", "component/profile/ProfileButton", "component/WordmarkLogo", "kitsui", "model/Profile", "Relic"], function (require, exports, Button_9, Card_1, DisplaySlot_7, Link_5, View_3, ProfileButton_2, WordmarkLogo_2, kitsui_50, Profile_2, Relic_15) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_9 = __importDefault(Button_9);
    Card_1 = __importDefault(Card_1);
    DisplaySlot_7 = __importDefault(DisplaySlot_7);
    Link_5 = __importDefault(Link_5);
    View_3 = __importDefault(View_3);
    ProfileButton_2 = __importDefault(ProfileButton_2);
    WordmarkLogo_2 = __importDefault(WordmarkLogo_2);
    Profile_2 = __importDefault(Profile_2);
    Relic_15 = __importDefault(Relic_15);
    exports.default = (0, View_3.default)(async (view) => {
        view.hasNavbar.value = false;
        view.style('splash-view');
        view.style.bind(view.loading.loaded, 'splash-view--ready');
        (0, Link_5.default)('/')
            .and(WordmarkLogo_2.default)
            .viewTransition('wordmark-logo-home-link')
            .appendTo((0, kitsui_50.Component)()
            .style('splash-view-wordmark')
            .style.bind(view.loading.loaded, 'splash-view-wordmark--ready')
            .appendTo(view));
        view.loading.appendTo(view);
        view.infoContainer.remove();
        const { signal, setProgress } = await view.loading.start();
        setProgress(null, quilt => quilt['view/splash/load/connecting']());
        const conduit = await Relic_15.default.connected;
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
        const columns = (0, kitsui_50.Component)().style('splash-view-columns').appendTo(view.loading);
        const Column = () => (0, kitsui_50.Component)()
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
        (0, DisplaySlot_7.default)()
            .style('splash-view-profile-list')
            .style.bind(authed.falsy, 'splash-view-profile-list--not-authed')
            .use(profiles, (slot, profiles) => {
            for (const profile of profiles)
                (0, ProfileButton_2.default)(profile)
                    .tweak(button => button.mode.setValue(profile.authed ? 'expanded' : 'collapsed'))
                    .appendTo(slot);
        })
            .appendToWhen(hasAnyProfiles, profileCard);
        (0, Button_9.default)()
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
            .and(Button_9.default)
            .text.set(quilt => quilt['view/splash/collections-card/action/view']())
            .appendTo(collectionsCard);
        const dataCard = Card().appendTo(collectionsColumn);
        dataCard.headerText.set(quilt => quilt['view/splash/data-card/title']());
        dataCard.descriptionText.set(quilt => quilt['view/splash/data-card/description']());
        (0, Link_5.default)('/data')
            .and(Button_9.default)
            .text.set(quilt => quilt['view/splash/data-card/action/view']())
            .appendTo(dataCard);
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
        (0, Route_1.default)('/data/$table/$hash/variants', DataView_1.default),
        (0, Route_1.default)('/data/$table/$hash/$augmentation', DataView_1.default),
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
define("navigation/Navigate", ["require", "exports", "kitsui", "kitsui/component/Dialog", "kitsui/component/Popover", "kitsui/utility/EventManipulator", "navigation/Routes"], function (require, exports, kitsui_51, Dialog_1, Popover_2, EventManipulator_1, Routes_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Dialog_1 = __importDefault(Dialog_1);
    Popover_2 = __importDefault(Popover_2);
    EventManipulator_1 = __importDefault(EventManipulator_1);
    Routes_1 = __importDefault(Routes_1);
    function Navigator() {
        const state = (0, kitsui_51.State)(location.href);
        const hash = (0, kitsui_51.State)(location.hash);
        const search = (() => {
            const state = (0, kitsui_51.State)({});
            state.subscribeManual(() => {
                const pathname = location.pathname;
                let search = new URLSearchParams(state.value).toString();
                search = search ? `?${search}` : '';
                if (search === location.search)
                    return;
                const hash = location.hash;
                const url = `${pathname}${search}${hash}`;
                history.pushState({}, '', `${location.origin}${url}`);
            });
            return Object.assign(state, {
                get(key) {
                    return state.value[key] ?? undefined;
                },
                set(key, value) {
                    if ((value === undefined || value === null) && state.value[key] !== undefined) {
                        delete state.value[key];
                        state.emit();
                    }
                    else if (value !== undefined && value !== null && state.value[key] !== value) {
                        state.value[key] = value;
                        state.emit();
                    }
                },
                delete(key) {
                    if (state.value[key] !== undefined) {
                        delete state.value[key];
                        state.emit();
                    }
                },
            });
        })();
        const refreshSearchState = () => search.asMutable?.setValue(Object.fromEntries(new URLSearchParams(location.search).entries()));
        refreshSearchState();
        let lastURL;
        const navigate = {
            state,
            hash,
            search,
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
                    refreshSearchState();
                    if (updateLast)
                        lastURL = new URL(location.href);
                }
            },
            toRawURL: (url) => {
                if (url.startsWith('http')) {
                    location.href = url;
                    refreshSearchState();
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
define("utility/DevServer", ["require", "exports", "utility/Env", "utility/Style"], function (require, exports, Env_3, Style_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Env_3 = __importDefault(Env_3);
    Style_1 = __importDefault(Style_1);
    var DevServer;
    (function (DevServer) {
        function listen() {
            if (Env_3.default.ENVIRONMENT !== 'dev')
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
define("utility/Strings", ["require", "exports", "utility/Define"], function (require, exports, Define_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Define_2 = __importDefault(Define_2);
    var Strings;
    (function (Strings) {
        function applyPrototypes() {
            (0, Define_2.default)(String.prototype, 'trimQuotes', function () {
                if (this[0] === '"' && this[this.length - 1] === '"')
                    return this.slice(1, -1);
                return this.slice();
            });
        }
        Strings.applyPrototypes = applyPrototypes;
    })(Strings || (Strings = {}));
    exports.default = Strings;
});
define("index", ["require", "exports", "component/Kit", "kitsui", "kitsui/utility/ActiveListener", "kitsui/utility/FocusListener", "kitsui/utility/HoverListener", "kitsui/utility/Mouse", "kitsui/utility/Viewport", "model/Profile", "navigation/Navigate", "Relic", "utility/Arrays", "utility/DevServer", "utility/Env", "utility/Strings", "utility/Text"], function (require, exports, Kit_1, kitsui_52, ActiveListener_1, FocusListener_1, HoverListener_1, Mouse_2, Viewport_1, Profile_3, Navigate_1, Relic_16, Arrays_9, DevServer_1, Env_4, Strings_1, Text_2) {
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
    Relic_16 = __importDefault(Relic_16);
    Arrays_9 = __importDefault(Arrays_9);
    DevServer_1 = __importDefault(DevServer_1);
    Env_4 = __importDefault(Env_4);
    Strings_1 = __importDefault(Strings_1);
    Text_2 = __importDefault(Text_2);
    Arrays_9.default.applyPrototypes();
    Strings_1.default.applyPrototypes();
    async function default_1() {
        kitsui_52.Component.allowBuilding();
        Text_2.default.init();
        kitsui_52.Component.getBody().style('body');
        await Env_4.default['init']();
        void Relic_16.default.init();
        void Profile_3.default.init();
        DevServer_1.default.listen();
        HoverListener_1.default.listen();
        ActiveListener_1.default.listen();
        FocusListener_1.default.listen();
        Mouse_2.default.listen();
        Viewport_1.default.listen();
        kitsui_52.Component.getBody().monitorScrollEvents();
        kitsui_52.Component.getDocument().monitorScrollEvents();
        kitsui_52.Component.getWindow().monitorScrollEvents();
        (0, Kit_1.default)();
        await (0, Navigate_1.default)().fromURL();
    }
});
define("component/core/ActionRow", ["require", "exports", "kitsui"], function (require, exports, kitsui_53) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_53.Component)(component => component.style('action-row'));
});
define("component/core/Checkbox", ["require", "exports", "kitsui"], function (require, exports, kitsui_54) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Checkbox = (0, kitsui_54.Component)('label', (component) => {
        const label = (0, kitsui_54.Component)().style('checkbox-label');
        const checked = (0, kitsui_54.State)(false);
        const input = (0, kitsui_54.Component)('input')
            .style('checkbox-input')
            .attributes.set('type', 'checkbox')
            .event.subscribe('change', event => checked.value = event.host.element.checked);
        return component.style('checkbox')
            .append(input)
            .append((0, kitsui_54.Component)()
            .style('checkbox-icon')
            .style.bind(checked, 'checkbox-icon--checked')
            .append((0, kitsui_54.Component)()
            .style('checkbox-icon-active-border')
            .style.bind(component.hoveredOrHasFocused, 'checkbox-icon-active-border--focus')
            .style.bind(component.active, 'checkbox-icon-active-border--active')
            .style.bind(checked, 'checkbox-icon-active-border--checked'))
            .append((0, kitsui_54.Component)()
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
define("component/core/Checklist", ["require", "exports", "kitsui"], function (require, exports, kitsui_55) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Checklist = (0, kitsui_55.Component)('ol', (component) => {
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
    const ChecklistItem = (0, kitsui_55.Component)('li', (component) => {
        const checked = (0, kitsui_55.State)(false);
        const marker = (0, kitsui_55.Component)().style('checklist-item-marker');
        const content = (0, kitsui_55.Component)().style('checklist-item-content');
        const checkIcon = (0, kitsui_55.Component)()
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
define("component/core/Footer", ["require", "exports", "kitsui"], function (require, exports, kitsui_56) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_56.Component)(component => component.style('footer'));
});
define("component/core/FormRow", ["require", "exports", "kitsui"], function (require, exports, kitsui_57) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const FormRow = (0, kitsui_57.Component)('label', (component) => {
        const label = (0, kitsui_57.Component)().style('form-row-label');
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
define("component/core/TextInput", ["require", "exports", "kitsui", "kitsui/utility/Applicator"], function (require, exports, kitsui_58, Applicator_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Applicator_1 = __importDefault(Applicator_1);
    const TextInput = (0, kitsui_58.Component)('input', (component) => {
        let defaultValue = '';
        const state = (0, kitsui_58.State)(defaultValue);
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
