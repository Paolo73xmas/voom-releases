(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/react/cjs/react.production.js
  var require_react_production = __commonJS({
    "node_modules/react/cjs/react.production.js"(exports) {
      "use strict";
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element");
      var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
      var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
      var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
      var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
      var REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer");
      var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
      var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
      var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
      var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
      var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
      var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      var ReactNoopUpdateQueue = {
        isMounted: function() {
          return false;
        },
        enqueueForceUpdate: function() {
        },
        enqueueReplaceState: function() {
        },
        enqueueSetState: function() {
        }
      };
      var assign = Object.assign;
      var emptyObject11 = {};
      function Component2(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject11;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      Component2.prototype.isReactComponent = {};
      Component2.prototype.setState = function(partialState, callback) {
        if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, partialState, callback, "setState");
      };
      Component2.prototype.forceUpdate = function(callback) {
        this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
      };
      function ComponentDummy() {
      }
      ComponentDummy.prototype = Component2.prototype;
      function PureComponent3(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject11;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      var pureComponentPrototype = PureComponent3.prototype = new ComponentDummy();
      pureComponentPrototype.constructor = PureComponent3;
      assign(pureComponentPrototype, Component2.prototype);
      pureComponentPrototype.isPureReactComponent = true;
      var isArrayImpl = Array.isArray;
      var ReactSharedInternals = { H: null, A: null, T: null, S: null, V: null };
      var hasOwnProperty2 = Object.prototype.hasOwnProperty;
      function ReactElement(type, key, self, source, owner, props) {
        self = props.ref;
        return {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          ref: void 0 !== self ? self : null,
          props
        };
      }
      function cloneAndReplaceKey(oldElement, newKey) {
        return ReactElement(
          oldElement.type,
          newKey,
          void 0,
          void 0,
          void 0,
          oldElement.props
        );
      }
      function isValidElement3(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      function escape(key) {
        var escaperLookup = { "=": "=0", ":": "=2" };
        return "$" + key.replace(/[=:]/g, function(match) {
          return escaperLookup[match];
        });
      }
      var userProvidedKeyEscapeRegex = /\/+/g;
      function getElementKey(element, index) {
        return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
      }
      function noop$1() {
      }
      function resolveThenable(thenable) {
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
          default:
            switch ("string" === typeof thenable.status ? thenable.then(noop$1, noop$1) : (thenable.status = "pending", thenable.then(
              function(fulfilledValue) {
                "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
              },
              function(error) {
                "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            )), thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenable.reason;
            }
        }
        throw thenable;
      }
      function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
        var type = typeof children;
        if ("undefined" === type || "boolean" === type) children = null;
        var invokeCallback = false;
        if (null === children) invokeCallback = true;
        else
          switch (type) {
            case "bigint":
            case "string":
            case "number":
              invokeCallback = true;
              break;
            case "object":
              switch (children.$$typeof) {
                case REACT_ELEMENT_TYPE:
                case REACT_PORTAL_TYPE:
                  invokeCallback = true;
                  break;
                case REACT_LAZY_TYPE:
                  return invokeCallback = children._init, mapIntoArray(
                    invokeCallback(children._payload),
                    array,
                    escapedPrefix,
                    nameSoFar,
                    callback
                  );
              }
          }
        if (invokeCallback)
          return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
            return c;
          })) : null != callback && (isValidElement3(callback) && (callback = cloneAndReplaceKey(
            callback,
            escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(
              userProvidedKeyEscapeRegex,
              "$&/"
            ) + "/") + invokeCallback
          )), array.push(callback)), 1;
        invokeCallback = 0;
        var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
        if (isArrayImpl(children))
          for (var i = 0; i < children.length; i++)
            nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if (i = getIteratorFn(children), "function" === typeof i)
          for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
            nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if ("object" === type) {
          if ("function" === typeof children.then)
            return mapIntoArray(
              resolveThenable(children),
              array,
              escapedPrefix,
              nameSoFar,
              callback
            );
          array = String(children);
          throw Error(
            "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return invokeCallback;
      }
      function mapChildren(children, func, context) {
        if (null == children) return children;
        var result = [], count = 0;
        mapIntoArray(children, result, "", "", function(child) {
          return func.call(context, child, count++);
        });
        return result;
      }
      function lazyInitializer(payload) {
        if (-1 === payload._status) {
          var ctor = payload._result;
          ctor = ctor();
          ctor.then(
            function(moduleObject) {
              if (0 === payload._status || -1 === payload._status)
                payload._status = 1, payload._result = moduleObject;
            },
            function(error) {
              if (0 === payload._status || -1 === payload._status)
                payload._status = 2, payload._result = error;
            }
          );
          -1 === payload._status && (payload._status = 0, payload._result = ctor);
        }
        if (1 === payload._status) return payload._result.default;
        throw payload._result;
      }
      var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      };
      function noop() {
      }
      exports.Children = {
        map: mapChildren,
        forEach: function(children, forEachFunc, forEachContext) {
          mapChildren(
            children,
            function() {
              forEachFunc.apply(this, arguments);
            },
            forEachContext
          );
        },
        count: function(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        },
        toArray: function(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        },
        only: function(children) {
          if (!isValidElement3(children))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return children;
        }
      };
      exports.Component = Component2;
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.Profiler = REACT_PROFILER_TYPE;
      exports.PureComponent = PureComponent3;
      exports.StrictMode = REACT_STRICT_MODE_TYPE;
      exports.Suspense = REACT_SUSPENSE_TYPE;
      exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
      exports.__COMPILER_RUNTIME = {
        __proto__: null,
        c: function(size) {
          return ReactSharedInternals.H.useMemoCache(size);
        }
      };
      exports.cache = function(fn) {
        return function() {
          return fn.apply(null, arguments);
        };
      };
      exports.cloneElement = function(element, config, children) {
        if (null === element || void 0 === element)
          throw Error(
            "The argument must be a React element, but you passed " + element + "."
          );
        var props = assign({}, element.props), key = element.key, owner = void 0;
        if (null != config)
          for (propName in void 0 !== config.ref && (owner = void 0), void 0 !== config.key && (key = "" + config.key), config)
            !hasOwnProperty2.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
        var propName = arguments.length - 2;
        if (1 === propName) props.children = children;
        else if (1 < propName) {
          for (var childArray = Array(propName), i = 0; i < propName; i++)
            childArray[i] = arguments[i + 2];
          props.children = childArray;
        }
        return ReactElement(element.type, key, void 0, void 0, owner, props);
      };
      exports.createContext = function(defaultValue) {
        defaultValue = {
          $$typeof: REACT_CONTEXT_TYPE,
          _currentValue: defaultValue,
          _currentValue2: defaultValue,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        };
        defaultValue.Provider = defaultValue;
        defaultValue.Consumer = {
          $$typeof: REACT_CONSUMER_TYPE,
          _context: defaultValue
        };
        return defaultValue;
      };
      exports.createElement = function(type, config, children) {
        var propName, props = {}, key = null;
        if (null != config)
          for (propName in void 0 !== config.key && (key = "" + config.key), config)
            hasOwnProperty2.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
        var childrenLength = arguments.length - 2;
        if (1 === childrenLength) props.children = children;
        else if (1 < childrenLength) {
          for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++)
            childArray[i] = arguments[i + 2];
          props.children = childArray;
        }
        if (type && type.defaultProps)
          for (propName in childrenLength = type.defaultProps, childrenLength)
            void 0 === props[propName] && (props[propName] = childrenLength[propName]);
        return ReactElement(type, key, void 0, void 0, null, props);
      };
      exports.createRef = function() {
        return { current: null };
      };
      exports.forwardRef = function(render) {
        return { $$typeof: REACT_FORWARD_REF_TYPE, render };
      };
      exports.isValidElement = isValidElement3;
      exports.lazy = function(ctor) {
        return {
          $$typeof: REACT_LAZY_TYPE,
          _payload: { _status: -1, _result: ctor },
          _init: lazyInitializer
        };
      };
      exports.memo = function(type, compare) {
        return {
          $$typeof: REACT_MEMO_TYPE,
          type,
          compare: void 0 === compare ? null : compare
        };
      };
      exports.startTransition = function(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        ReactSharedInternals.T = currentTransition;
        try {
          var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
        } catch (error) {
          reportGlobalError(error);
        } finally {
          ReactSharedInternals.T = prevTransition;
        }
      };
      exports.unstable_useCacheRefresh = function() {
        return ReactSharedInternals.H.useCacheRefresh();
      };
      exports.use = function(usable) {
        return ReactSharedInternals.H.use(usable);
      };
      exports.useActionState = function(action, initialState, permalink) {
        return ReactSharedInternals.H.useActionState(action, initialState, permalink);
      };
      exports.useCallback = function(callback, deps) {
        return ReactSharedInternals.H.useCallback(callback, deps);
      };
      exports.useContext = function(Context) {
        return ReactSharedInternals.H.useContext(Context);
      };
      exports.useDebugValue = function() {
      };
      exports.useDeferredValue = function(value, initialValue) {
        return ReactSharedInternals.H.useDeferredValue(value, initialValue);
      };
      exports.useEffect = function(create2, createDeps, update2) {
        var dispatcher = ReactSharedInternals.H;
        if ("function" === typeof update2)
          throw Error(
            "useEffect CRUD overload is not enabled in this build of React."
          );
        return dispatcher.useEffect(create2, createDeps);
      };
      exports.useId = function() {
        return ReactSharedInternals.H.useId();
      };
      exports.useImperativeHandle = function(ref, create2, deps) {
        return ReactSharedInternals.H.useImperativeHandle(ref, create2, deps);
      };
      exports.useInsertionEffect = function(create2, deps) {
        return ReactSharedInternals.H.useInsertionEffect(create2, deps);
      };
      exports.useLayoutEffect = function(create2, deps) {
        return ReactSharedInternals.H.useLayoutEffect(create2, deps);
      };
      exports.useMemo = function(create2, deps) {
        return ReactSharedInternals.H.useMemo(create2, deps);
      };
      exports.useOptimistic = function(passthrough, reducer) {
        return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
      };
      exports.useReducer = function(reducer, initialArg, init) {
        return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
      };
      exports.useRef = function(initialValue) {
        return ReactSharedInternals.H.useRef(initialValue);
      };
      exports.useState = function(initialState) {
        return ReactSharedInternals.H.useState(initialState);
      };
      exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
        return ReactSharedInternals.H.useSyncExternalStore(
          subscribe,
          getSnapshot,
          getServerSnapshot
        );
      };
      exports.useTransition = function() {
        return ReactSharedInternals.H.useTransition();
      };
      exports.version = "19.1.0";
    }
  });

  // node_modules/react/index.js
  var require_react = __commonJS({
    "node_modules/react/index.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_react_production();
      } else {
        module.exports = null;
      }
    }
  });

  // node_modules/scheduler/cjs/scheduler.production.js
  var require_scheduler_production = __commonJS({
    "node_modules/scheduler/cjs/scheduler.production.js"(exports) {
      "use strict";
      function push(heap, node) {
        var index = heap.length;
        heap.push(node);
        a: for (; 0 < index; ) {
          var parentIndex = index - 1 >>> 1, parent = heap[parentIndex];
          if (0 < compare(parent, node))
            heap[parentIndex] = node, heap[index] = parent, index = parentIndex;
          else break a;
        }
      }
      function peek(heap) {
        return 0 === heap.length ? null : heap[0];
      }
      function pop(heap) {
        if (0 === heap.length) return null;
        var first = heap[0], last = heap.pop();
        if (last !== first) {
          heap[0] = last;
          a: for (var index = 0, length = heap.length, halfLength = length >>> 1; index < halfLength; ) {
            var leftIndex = 2 * (index + 1) - 1, left2 = heap[leftIndex], rightIndex = leftIndex + 1, right2 = heap[rightIndex];
            if (0 > compare(left2, last))
              rightIndex < length && 0 > compare(right2, left2) ? (heap[index] = right2, heap[rightIndex] = last, index = rightIndex) : (heap[index] = left2, heap[leftIndex] = last, index = leftIndex);
            else if (rightIndex < length && 0 > compare(right2, last))
              heap[index] = right2, heap[rightIndex] = last, index = rightIndex;
            else break a;
          }
        }
        return first;
      }
      function compare(a, b) {
        var diff = a.sortIndex - b.sortIndex;
        return 0 !== diff ? diff : a.id - b.id;
      }
      exports.unstable_now = void 0;
      if ("object" === typeof performance && "function" === typeof performance.now) {
        localPerformance = performance;
        exports.unstable_now = function() {
          return localPerformance.now();
        };
      } else {
        localDate = Date, initialTime = localDate.now();
        exports.unstable_now = function() {
          return localDate.now() - initialTime;
        };
      }
      var localPerformance;
      var localDate;
      var initialTime;
      var taskQueue = [];
      var timerQueue = [];
      var taskIdCounter = 1;
      var currentTask = null;
      var currentPriorityLevel = 3;
      var isPerformingWork = false;
      var isHostCallbackScheduled = false;
      var isHostTimeoutScheduled = false;
      var needsPaint = false;
      var localSetTimeout = "function" === typeof setTimeout ? setTimeout : null;
      var localClearTimeout = "function" === typeof clearTimeout ? clearTimeout : null;
      var localSetImmediate = "undefined" !== typeof setImmediate ? setImmediate : null;
      function advanceTimers(currentTime) {
        for (var timer = peek(timerQueue); null !== timer; ) {
          if (null === timer.callback) pop(timerQueue);
          else if (timer.startTime <= currentTime)
            pop(timerQueue), timer.sortIndex = timer.expirationTime, push(taskQueue, timer);
          else break;
          timer = peek(timerQueue);
        }
      }
      function handleTimeout(currentTime) {
        isHostTimeoutScheduled = false;
        advanceTimers(currentTime);
        if (!isHostCallbackScheduled)
          if (null !== peek(taskQueue))
            isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline());
          else {
            var firstTimer = peek(timerQueue);
            null !== firstTimer && requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
          }
      }
      var isMessageLoopRunning = false;
      var taskTimeoutID = -1;
      var frameInterval = 5;
      var startTime = -1;
      function shouldYieldToHost() {
        return needsPaint ? true : exports.unstable_now() - startTime < frameInterval ? false : true;
      }
      function performWorkUntilDeadline() {
        needsPaint = false;
        if (isMessageLoopRunning) {
          var currentTime = exports.unstable_now();
          startTime = currentTime;
          var hasMoreWork = true;
          try {
            a: {
              isHostCallbackScheduled = false;
              isHostTimeoutScheduled && (isHostTimeoutScheduled = false, localClearTimeout(taskTimeoutID), taskTimeoutID = -1);
              isPerformingWork = true;
              var previousPriorityLevel = currentPriorityLevel;
              try {
                b: {
                  advanceTimers(currentTime);
                  for (currentTask = peek(taskQueue); null !== currentTask && !(currentTask.expirationTime > currentTime && shouldYieldToHost()); ) {
                    var callback = currentTask.callback;
                    if ("function" === typeof callback) {
                      currentTask.callback = null;
                      currentPriorityLevel = currentTask.priorityLevel;
                      var continuationCallback = callback(
                        currentTask.expirationTime <= currentTime
                      );
                      currentTime = exports.unstable_now();
                      if ("function" === typeof continuationCallback) {
                        currentTask.callback = continuationCallback;
                        advanceTimers(currentTime);
                        hasMoreWork = true;
                        break b;
                      }
                      currentTask === peek(taskQueue) && pop(taskQueue);
                      advanceTimers(currentTime);
                    } else pop(taskQueue);
                    currentTask = peek(taskQueue);
                  }
                  if (null !== currentTask) hasMoreWork = true;
                  else {
                    var firstTimer = peek(timerQueue);
                    null !== firstTimer && requestHostTimeout(
                      handleTimeout,
                      firstTimer.startTime - currentTime
                    );
                    hasMoreWork = false;
                  }
                }
                break a;
              } finally {
                currentTask = null, currentPriorityLevel = previousPriorityLevel, isPerformingWork = false;
              }
              hasMoreWork = void 0;
            }
          } finally {
            hasMoreWork ? schedulePerformWorkUntilDeadline() : isMessageLoopRunning = false;
          }
        }
      }
      var schedulePerformWorkUntilDeadline;
      if ("function" === typeof localSetImmediate)
        schedulePerformWorkUntilDeadline = function() {
          localSetImmediate(performWorkUntilDeadline);
        };
      else if ("undefined" !== typeof MessageChannel) {
        channel = new MessageChannel(), port = channel.port2;
        channel.port1.onmessage = performWorkUntilDeadline;
        schedulePerformWorkUntilDeadline = function() {
          port.postMessage(null);
        };
      } else
        schedulePerformWorkUntilDeadline = function() {
          localSetTimeout(performWorkUntilDeadline, 0);
        };
      var channel;
      var port;
      function requestHostTimeout(callback, ms) {
        taskTimeoutID = localSetTimeout(function() {
          callback(exports.unstable_now());
        }, ms);
      }
      exports.unstable_IdlePriority = 5;
      exports.unstable_ImmediatePriority = 1;
      exports.unstable_LowPriority = 4;
      exports.unstable_NormalPriority = 3;
      exports.unstable_Profiling = null;
      exports.unstable_UserBlockingPriority = 2;
      exports.unstable_cancelCallback = function(task) {
        task.callback = null;
      };
      exports.unstable_forceFrameRate = function(fps) {
        0 > fps || 125 < fps ? console.error(
          "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
        ) : frameInterval = 0 < fps ? Math.floor(1e3 / fps) : 5;
      };
      exports.unstable_getCurrentPriorityLevel = function() {
        return currentPriorityLevel;
      };
      exports.unstable_next = function(eventHandler) {
        switch (currentPriorityLevel) {
          case 1:
          case 2:
          case 3:
            var priorityLevel = 3;
            break;
          default:
            priorityLevel = currentPriorityLevel;
        }
        var previousPriorityLevel = currentPriorityLevel;
        currentPriorityLevel = priorityLevel;
        try {
          return eventHandler();
        } finally {
          currentPriorityLevel = previousPriorityLevel;
        }
      };
      exports.unstable_requestPaint = function() {
        needsPaint = true;
      };
      exports.unstable_runWithPriority = function(priorityLevel, eventHandler) {
        switch (priorityLevel) {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
            break;
          default:
            priorityLevel = 3;
        }
        var previousPriorityLevel = currentPriorityLevel;
        currentPriorityLevel = priorityLevel;
        try {
          return eventHandler();
        } finally {
          currentPriorityLevel = previousPriorityLevel;
        }
      };
      exports.unstable_scheduleCallback = function(priorityLevel, callback, options) {
        var currentTime = exports.unstable_now();
        "object" === typeof options && null !== options ? (options = options.delay, options = "number" === typeof options && 0 < options ? currentTime + options : currentTime) : options = currentTime;
        switch (priorityLevel) {
          case 1:
            var timeout = -1;
            break;
          case 2:
            timeout = 250;
            break;
          case 5:
            timeout = 1073741823;
            break;
          case 4:
            timeout = 1e4;
            break;
          default:
            timeout = 5e3;
        }
        timeout = options + timeout;
        priorityLevel = {
          id: taskIdCounter++,
          callback,
          priorityLevel,
          startTime: options,
          expirationTime: timeout,
          sortIndex: -1
        };
        options > currentTime ? (priorityLevel.sortIndex = options, push(timerQueue, priorityLevel), null === peek(taskQueue) && priorityLevel === peek(timerQueue) && (isHostTimeoutScheduled ? (localClearTimeout(taskTimeoutID), taskTimeoutID = -1) : isHostTimeoutScheduled = true, requestHostTimeout(handleTimeout, options - currentTime))) : (priorityLevel.sortIndex = timeout, push(taskQueue, priorityLevel), isHostCallbackScheduled || isPerformingWork || (isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline())));
        return priorityLevel;
      };
      exports.unstable_shouldYield = shouldYieldToHost;
      exports.unstable_wrapCallback = function(callback) {
        var parentPriorityLevel = currentPriorityLevel;
        return function() {
          var previousPriorityLevel = currentPriorityLevel;
          currentPriorityLevel = parentPriorityLevel;
          try {
            return callback.apply(this, arguments);
          } finally {
            currentPriorityLevel = previousPriorityLevel;
          }
        };
      };
    }
  });

  // node_modules/scheduler/index.js
  var require_scheduler = __commonJS({
    "node_modules/scheduler/index.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_scheduler_production();
      } else {
        module.exports = null;
      }
    }
  });

  // node_modules/react-dom/cjs/react-dom.production.js
  var require_react_dom_production = __commonJS({
    "node_modules/react-dom/cjs/react-dom.production.js"(exports) {
      "use strict";
      var React27 = require_react();
      function formatProdErrorMessage(code) {
        var url = "https://react.dev/errors/" + code;
        if (1 < arguments.length) {
          url += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var i = 2; i < arguments.length; i++)
            url += "&args[]=" + encodeURIComponent(arguments[i]);
        }
        return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function noop() {
      }
      var Internals = {
        d: {
          f: noop,
          r: function() {
            throw Error(formatProdErrorMessage(522));
          },
          D: noop,
          C: noop,
          L: noop,
          m: noop,
          X: noop,
          S: noop,
          M: noop
        },
        p: 0,
        findDOMNode: null
      };
      var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
      function createPortal$1(children, containerInfo, implementation) {
        var key = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
        return {
          $$typeof: REACT_PORTAL_TYPE,
          key: null == key ? null : "" + key,
          children,
          containerInfo,
          implementation
        };
      }
      var ReactSharedInternals = React27.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      function getCrossOriginStringAs(as, input) {
        if ("font" === as) return "";
        if ("string" === typeof input)
          return "use-credentials" === input ? input : "";
      }
      exports.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Internals;
      exports.createPortal = function(children, container) {
        var key = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
        if (!container || 1 !== container.nodeType && 9 !== container.nodeType && 11 !== container.nodeType)
          throw Error(formatProdErrorMessage(299));
        return createPortal$1(children, container, null, key);
      };
      exports.flushSync = function(fn) {
        var previousTransition = ReactSharedInternals.T, previousUpdatePriority = Internals.p;
        try {
          if (ReactSharedInternals.T = null, Internals.p = 2, fn) return fn();
        } finally {
          ReactSharedInternals.T = previousTransition, Internals.p = previousUpdatePriority, Internals.d.f();
        }
      };
      exports.preconnect = function(href, options) {
        "string" === typeof href && (options ? (options = options.crossOrigin, options = "string" === typeof options ? "use-credentials" === options ? options : "" : void 0) : options = null, Internals.d.C(href, options));
      };
      exports.prefetchDNS = function(href) {
        "string" === typeof href && Internals.d.D(href);
      };
      exports.preinit = function(href, options) {
        if ("string" === typeof href && options && "string" === typeof options.as) {
          var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin), integrity = "string" === typeof options.integrity ? options.integrity : void 0, fetchPriority = "string" === typeof options.fetchPriority ? options.fetchPriority : void 0;
          "style" === as ? Internals.d.S(
            href,
            "string" === typeof options.precedence ? options.precedence : void 0,
            {
              crossOrigin,
              integrity,
              fetchPriority
            }
          ) : "script" === as && Internals.d.X(href, {
            crossOrigin,
            integrity,
            fetchPriority,
            nonce: "string" === typeof options.nonce ? options.nonce : void 0
          });
        }
      };
      exports.preinitModule = function(href, options) {
        if ("string" === typeof href)
          if ("object" === typeof options && null !== options) {
            if (null == options.as || "script" === options.as) {
              var crossOrigin = getCrossOriginStringAs(
                options.as,
                options.crossOrigin
              );
              Internals.d.M(href, {
                crossOrigin,
                integrity: "string" === typeof options.integrity ? options.integrity : void 0,
                nonce: "string" === typeof options.nonce ? options.nonce : void 0
              });
            }
          } else null == options && Internals.d.M(href);
      };
      exports.preload = function(href, options) {
        if ("string" === typeof href && "object" === typeof options && null !== options && "string" === typeof options.as) {
          var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin);
          Internals.d.L(href, as, {
            crossOrigin,
            integrity: "string" === typeof options.integrity ? options.integrity : void 0,
            nonce: "string" === typeof options.nonce ? options.nonce : void 0,
            type: "string" === typeof options.type ? options.type : void 0,
            fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0,
            referrerPolicy: "string" === typeof options.referrerPolicy ? options.referrerPolicy : void 0,
            imageSrcSet: "string" === typeof options.imageSrcSet ? options.imageSrcSet : void 0,
            imageSizes: "string" === typeof options.imageSizes ? options.imageSizes : void 0,
            media: "string" === typeof options.media ? options.media : void 0
          });
        }
      };
      exports.preloadModule = function(href, options) {
        if ("string" === typeof href)
          if (options) {
            var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
            Internals.d.m(href, {
              as: "string" === typeof options.as && "script" !== options.as ? options.as : void 0,
              crossOrigin,
              integrity: "string" === typeof options.integrity ? options.integrity : void 0
            });
          } else Internals.d.m(href);
      };
      exports.requestFormReset = function(form) {
        Internals.d.r(form);
      };
      exports.unstable_batchedUpdates = function(fn, a) {
        return fn(a);
      };
      exports.useFormState = function(action, initialState, permalink) {
        return ReactSharedInternals.H.useFormState(action, initialState, permalink);
      };
      exports.useFormStatus = function() {
        return ReactSharedInternals.H.useHostTransitionStatus();
      };
      exports.version = "19.1.0";
    }
  });

  // node_modules/react-dom/index.js
  var require_react_dom = __commonJS({
    "node_modules/react-dom/index.js"(exports, module) {
      "use strict";
      function checkDCE() {
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
          return;
        }
        if (false) {
          throw new Error("^_^");
        }
        try {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
        } catch (err) {
          console.error(err);
        }
      }
      if (true) {
        checkDCE();
        module.exports = require_react_dom_production();
      } else {
        module.exports = null;
      }
    }
  });

  // node_modules/react-dom/cjs/react-dom-client.production.js
  var require_react_dom_client_production = __commonJS({
    "node_modules/react-dom/cjs/react-dom-client.production.js"(exports) {
      "use strict";
      var Scheduler = require_scheduler();
      var React27 = require_react();
      var ReactDOM = require_react_dom();
      function formatProdErrorMessage(code) {
        var url = "https://react.dev/errors/" + code;
        if (1 < arguments.length) {
          url += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var i = 2; i < arguments.length; i++)
            url += "&args[]=" + encodeURIComponent(arguments[i]);
        }
        return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function isValidContainer(node) {
        return !(!node || 1 !== node.nodeType && 9 !== node.nodeType && 11 !== node.nodeType);
      }
      function getNearestMountedFiber(fiber) {
        var node = fiber, nearestMounted = fiber;
        if (fiber.alternate) for (; node.return; ) node = node.return;
        else {
          fiber = node;
          do
            node = fiber, 0 !== (node.flags & 4098) && (nearestMounted = node.return), fiber = node.return;
          while (fiber);
        }
        return 3 === node.tag ? nearestMounted : null;
      }
      function getSuspenseInstanceFromFiber(fiber) {
        if (13 === fiber.tag) {
          var suspenseState = fiber.memoizedState;
          null === suspenseState && (fiber = fiber.alternate, null !== fiber && (suspenseState = fiber.memoizedState));
          if (null !== suspenseState) return suspenseState.dehydrated;
        }
        return null;
      }
      function assertIsMounted(fiber) {
        if (getNearestMountedFiber(fiber) !== fiber)
          throw Error(formatProdErrorMessage(188));
      }
      function findCurrentFiberUsingSlowPath(fiber) {
        var alternate = fiber.alternate;
        if (!alternate) {
          alternate = getNearestMountedFiber(fiber);
          if (null === alternate) throw Error(formatProdErrorMessage(188));
          return alternate !== fiber ? null : fiber;
        }
        for (var a = fiber, b = alternate; ; ) {
          var parentA = a.return;
          if (null === parentA) break;
          var parentB = parentA.alternate;
          if (null === parentB) {
            b = parentA.return;
            if (null !== b) {
              a = b;
              continue;
            }
            break;
          }
          if (parentA.child === parentB.child) {
            for (parentB = parentA.child; parentB; ) {
              if (parentB === a) return assertIsMounted(parentA), fiber;
              if (parentB === b) return assertIsMounted(parentA), alternate;
              parentB = parentB.sibling;
            }
            throw Error(formatProdErrorMessage(188));
          }
          if (a.return !== b.return) a = parentA, b = parentB;
          else {
            for (var didFindChild = false, child$0 = parentA.child; child$0; ) {
              if (child$0 === a) {
                didFindChild = true;
                a = parentA;
                b = parentB;
                break;
              }
              if (child$0 === b) {
                didFindChild = true;
                b = parentA;
                a = parentB;
                break;
              }
              child$0 = child$0.sibling;
            }
            if (!didFindChild) {
              for (child$0 = parentB.child; child$0; ) {
                if (child$0 === a) {
                  didFindChild = true;
                  a = parentB;
                  b = parentA;
                  break;
                }
                if (child$0 === b) {
                  didFindChild = true;
                  b = parentB;
                  a = parentA;
                  break;
                }
                child$0 = child$0.sibling;
              }
              if (!didFindChild) throw Error(formatProdErrorMessage(189));
            }
          }
          if (a.alternate !== b) throw Error(formatProdErrorMessage(190));
        }
        if (3 !== a.tag) throw Error(formatProdErrorMessage(188));
        return a.stateNode.current === a ? fiber : alternate;
      }
      function findCurrentHostFiberImpl(node) {
        var tag = node.tag;
        if (5 === tag || 26 === tag || 27 === tag || 6 === tag) return node;
        for (node = node.child; null !== node; ) {
          tag = findCurrentHostFiberImpl(node);
          if (null !== tag) return tag;
          node = node.sibling;
        }
        return null;
      }
      var assign = Object.assign;
      var REACT_LEGACY_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.element");
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element");
      var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
      var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
      var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
      var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
      var REACT_PROVIDER_TYPE = /* @__PURE__ */ Symbol.for("react.provider");
      var REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer");
      var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
      var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
      var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
      var REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list");
      var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
      var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
      var REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity");
      var REACT_MEMO_CACHE_SENTINEL = /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel");
      var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      var REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for("react.client.reference");
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
        }
        if ("object" === typeof type)
          switch (type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return (type.displayName || "Context") + ".Provider";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x) {
              }
          }
        return null;
      }
      var isArrayImpl = Array.isArray;
      var ReactSharedInternals = React27.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      var ReactDOMSharedInternals = ReactDOM.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      var sharedNotPendingObject = {
        pending: false,
        data: null,
        method: null,
        action: null
      };
      var valueStack = [];
      var index = -1;
      function createCursor(defaultValue) {
        return { current: defaultValue };
      }
      function pop(cursor) {
        0 > index || (cursor.current = valueStack[index], valueStack[index] = null, index--);
      }
      function push(cursor, value) {
        index++;
        valueStack[index] = cursor.current;
        cursor.current = value;
      }
      var contextStackCursor = createCursor(null);
      var contextFiberStackCursor = createCursor(null);
      var rootInstanceStackCursor = createCursor(null);
      var hostTransitionProviderCursor = createCursor(null);
      function pushHostContainer(fiber, nextRootInstance) {
        push(rootInstanceStackCursor, nextRootInstance);
        push(contextFiberStackCursor, fiber);
        push(contextStackCursor, null);
        switch (nextRootInstance.nodeType) {
          case 9:
          case 11:
            fiber = (fiber = nextRootInstance.documentElement) ? (fiber = fiber.namespaceURI) ? getOwnHostContext(fiber) : 0 : 0;
            break;
          default:
            if (fiber = nextRootInstance.tagName, nextRootInstance = nextRootInstance.namespaceURI)
              nextRootInstance = getOwnHostContext(nextRootInstance), fiber = getChildHostContextProd(nextRootInstance, fiber);
            else
              switch (fiber) {
                case "svg":
                  fiber = 1;
                  break;
                case "math":
                  fiber = 2;
                  break;
                default:
                  fiber = 0;
              }
        }
        pop(contextStackCursor);
        push(contextStackCursor, fiber);
      }
      function popHostContainer() {
        pop(contextStackCursor);
        pop(contextFiberStackCursor);
        pop(rootInstanceStackCursor);
      }
      function pushHostContext(fiber) {
        null !== fiber.memoizedState && push(hostTransitionProviderCursor, fiber);
        var context = contextStackCursor.current;
        var JSCompiler_inline_result = getChildHostContextProd(context, fiber.type);
        context !== JSCompiler_inline_result && (push(contextFiberStackCursor, fiber), push(contextStackCursor, JSCompiler_inline_result));
      }
      function popHostContext(fiber) {
        contextFiberStackCursor.current === fiber && (pop(contextStackCursor), pop(contextFiberStackCursor));
        hostTransitionProviderCursor.current === fiber && (pop(hostTransitionProviderCursor), HostTransitionContext._currentValue = sharedNotPendingObject);
      }
      var hasOwnProperty2 = Object.prototype.hasOwnProperty;
      var scheduleCallback$3 = Scheduler.unstable_scheduleCallback;
      var cancelCallback$1 = Scheduler.unstable_cancelCallback;
      var shouldYield = Scheduler.unstable_shouldYield;
      var requestPaint = Scheduler.unstable_requestPaint;
      var now = Scheduler.unstable_now;
      var getCurrentPriorityLevel = Scheduler.unstable_getCurrentPriorityLevel;
      var ImmediatePriority = Scheduler.unstable_ImmediatePriority;
      var UserBlockingPriority = Scheduler.unstable_UserBlockingPriority;
      var NormalPriority$1 = Scheduler.unstable_NormalPriority;
      var LowPriority = Scheduler.unstable_LowPriority;
      var IdlePriority = Scheduler.unstable_IdlePriority;
      var log$1 = Scheduler.log;
      var unstable_setDisableYieldValue = Scheduler.unstable_setDisableYieldValue;
      var rendererID = null;
      var injectedHook = null;
      function setIsStrictModeForDevtools(newIsStrictMode) {
        "function" === typeof log$1 && unstable_setDisableYieldValue(newIsStrictMode);
        if (injectedHook && "function" === typeof injectedHook.setStrictMode)
          try {
            injectedHook.setStrictMode(rendererID, newIsStrictMode);
          } catch (err) {
          }
      }
      var clz32 = Math.clz32 ? Math.clz32 : clz32Fallback;
      var log = Math.log;
      var LN2 = Math.LN2;
      function clz32Fallback(x) {
        x >>>= 0;
        return 0 === x ? 32 : 31 - (log(x) / LN2 | 0) | 0;
      }
      var nextTransitionLane = 256;
      var nextRetryLane = 4194304;
      function getHighestPriorityLanes(lanes) {
        var pendingSyncLanes = lanes & 42;
        if (0 !== pendingSyncLanes) return pendingSyncLanes;
        switch (lanes & -lanes) {
          case 1:
            return 1;
          case 2:
            return 2;
          case 4:
            return 4;
          case 8:
            return 8;
          case 16:
            return 16;
          case 32:
            return 32;
          case 64:
            return 64;
          case 128:
            return 128;
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return lanes & 4194048;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            return lanes & 62914560;
          case 67108864:
            return 67108864;
          case 134217728:
            return 134217728;
          case 268435456:
            return 268435456;
          case 536870912:
            return 536870912;
          case 1073741824:
            return 0;
          default:
            return lanes;
        }
      }
      function getNextLanes(root2, wipLanes, rootHasPendingCommit) {
        var pendingLanes = root2.pendingLanes;
        if (0 === pendingLanes) return 0;
        var nextLanes = 0, suspendedLanes = root2.suspendedLanes, pingedLanes = root2.pingedLanes;
        root2 = root2.warmLanes;
        var nonIdlePendingLanes = pendingLanes & 134217727;
        0 !== nonIdlePendingLanes ? (pendingLanes = nonIdlePendingLanes & ~suspendedLanes, 0 !== pendingLanes ? nextLanes = getHighestPriorityLanes(pendingLanes) : (pingedLanes &= nonIdlePendingLanes, 0 !== pingedLanes ? nextLanes = getHighestPriorityLanes(pingedLanes) : rootHasPendingCommit || (rootHasPendingCommit = nonIdlePendingLanes & ~root2, 0 !== rootHasPendingCommit && (nextLanes = getHighestPriorityLanes(rootHasPendingCommit))))) : (nonIdlePendingLanes = pendingLanes & ~suspendedLanes, 0 !== nonIdlePendingLanes ? nextLanes = getHighestPriorityLanes(nonIdlePendingLanes) : 0 !== pingedLanes ? nextLanes = getHighestPriorityLanes(pingedLanes) : rootHasPendingCommit || (rootHasPendingCommit = pendingLanes & ~root2, 0 !== rootHasPendingCommit && (nextLanes = getHighestPriorityLanes(rootHasPendingCommit))));
        return 0 === nextLanes ? 0 : 0 !== wipLanes && wipLanes !== nextLanes && 0 === (wipLanes & suspendedLanes) && (suspendedLanes = nextLanes & -nextLanes, rootHasPendingCommit = wipLanes & -wipLanes, suspendedLanes >= rootHasPendingCommit || 32 === suspendedLanes && 0 !== (rootHasPendingCommit & 4194048)) ? wipLanes : nextLanes;
      }
      function checkIfRootIsPrerendering(root2, renderLanes2) {
        return 0 === (root2.pendingLanes & ~(root2.suspendedLanes & ~root2.pingedLanes) & renderLanes2);
      }
      function computeExpirationTime(lane, currentTime) {
        switch (lane) {
          case 1:
          case 2:
          case 4:
          case 8:
          case 64:
            return currentTime + 250;
          case 16:
          case 32:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return currentTime + 5e3;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            return -1;
          case 67108864:
          case 134217728:
          case 268435456:
          case 536870912:
          case 1073741824:
            return -1;
          default:
            return -1;
        }
      }
      function claimNextTransitionLane() {
        var lane = nextTransitionLane;
        nextTransitionLane <<= 1;
        0 === (nextTransitionLane & 4194048) && (nextTransitionLane = 256);
        return lane;
      }
      function claimNextRetryLane() {
        var lane = nextRetryLane;
        nextRetryLane <<= 1;
        0 === (nextRetryLane & 62914560) && (nextRetryLane = 4194304);
        return lane;
      }
      function createLaneMap(initial) {
        for (var laneMap = [], i = 0; 31 > i; i++) laneMap.push(initial);
        return laneMap;
      }
      function markRootUpdated$1(root2, updateLane) {
        root2.pendingLanes |= updateLane;
        268435456 !== updateLane && (root2.suspendedLanes = 0, root2.pingedLanes = 0, root2.warmLanes = 0);
      }
      function markRootFinished(root2, finishedLanes, remainingLanes, spawnedLane, updatedLanes, suspendedRetryLanes) {
        var previouslyPendingLanes = root2.pendingLanes;
        root2.pendingLanes = remainingLanes;
        root2.suspendedLanes = 0;
        root2.pingedLanes = 0;
        root2.warmLanes = 0;
        root2.expiredLanes &= remainingLanes;
        root2.entangledLanes &= remainingLanes;
        root2.errorRecoveryDisabledLanes &= remainingLanes;
        root2.shellSuspendCounter = 0;
        var entanglements = root2.entanglements, expirationTimes = root2.expirationTimes, hiddenUpdates = root2.hiddenUpdates;
        for (remainingLanes = previouslyPendingLanes & ~remainingLanes; 0 < remainingLanes; ) {
          var index$5 = 31 - clz32(remainingLanes), lane = 1 << index$5;
          entanglements[index$5] = 0;
          expirationTimes[index$5] = -1;
          var hiddenUpdatesForLane = hiddenUpdates[index$5];
          if (null !== hiddenUpdatesForLane)
            for (hiddenUpdates[index$5] = null, index$5 = 0; index$5 < hiddenUpdatesForLane.length; index$5++) {
              var update2 = hiddenUpdatesForLane[index$5];
              null !== update2 && (update2.lane &= -536870913);
            }
          remainingLanes &= ~lane;
        }
        0 !== spawnedLane && markSpawnedDeferredLane(root2, spawnedLane, 0);
        0 !== suspendedRetryLanes && 0 === updatedLanes && 0 !== root2.tag && (root2.suspendedLanes |= suspendedRetryLanes & ~(previouslyPendingLanes & ~finishedLanes));
      }
      function markSpawnedDeferredLane(root2, spawnedLane, entangledLanes) {
        root2.pendingLanes |= spawnedLane;
        root2.suspendedLanes &= ~spawnedLane;
        var spawnedLaneIndex = 31 - clz32(spawnedLane);
        root2.entangledLanes |= spawnedLane;
        root2.entanglements[spawnedLaneIndex] = root2.entanglements[spawnedLaneIndex] | 1073741824 | entangledLanes & 4194090;
      }
      function markRootEntangled(root2, entangledLanes) {
        var rootEntangledLanes = root2.entangledLanes |= entangledLanes;
        for (root2 = root2.entanglements; rootEntangledLanes; ) {
          var index$6 = 31 - clz32(rootEntangledLanes), lane = 1 << index$6;
          lane & entangledLanes | root2[index$6] & entangledLanes && (root2[index$6] |= entangledLanes);
          rootEntangledLanes &= ~lane;
        }
      }
      function getBumpedLaneForHydrationByLane(lane) {
        switch (lane) {
          case 2:
            lane = 1;
            break;
          case 8:
            lane = 4;
            break;
          case 32:
            lane = 16;
            break;
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            lane = 128;
            break;
          case 268435456:
            lane = 134217728;
            break;
          default:
            lane = 0;
        }
        return lane;
      }
      function lanesToEventPriority(lanes) {
        lanes &= -lanes;
        return 2 < lanes ? 8 < lanes ? 0 !== (lanes & 134217727) ? 32 : 268435456 : 8 : 2;
      }
      function resolveUpdatePriority() {
        var updatePriority = ReactDOMSharedInternals.p;
        if (0 !== updatePriority) return updatePriority;
        updatePriority = window.event;
        return void 0 === updatePriority ? 32 : getEventPriority(updatePriority.type);
      }
      function runWithPriority(priority, fn) {
        var previousPriority = ReactDOMSharedInternals.p;
        try {
          return ReactDOMSharedInternals.p = priority, fn();
        } finally {
          ReactDOMSharedInternals.p = previousPriority;
        }
      }
      var randomKey = Math.random().toString(36).slice(2);
      var internalInstanceKey = "__reactFiber$" + randomKey;
      var internalPropsKey = "__reactProps$" + randomKey;
      var internalContainerInstanceKey = "__reactContainer$" + randomKey;
      var internalEventHandlersKey = "__reactEvents$" + randomKey;
      var internalEventHandlerListenersKey = "__reactListeners$" + randomKey;
      var internalEventHandlesSetKey = "__reactHandles$" + randomKey;
      var internalRootNodeResourcesKey = "__reactResources$" + randomKey;
      var internalHoistableMarker = "__reactMarker$" + randomKey;
      function detachDeletedInstance(node) {
        delete node[internalInstanceKey];
        delete node[internalPropsKey];
        delete node[internalEventHandlersKey];
        delete node[internalEventHandlerListenersKey];
        delete node[internalEventHandlesSetKey];
      }
      function getClosestInstanceFromNode(targetNode) {
        var targetInst = targetNode[internalInstanceKey];
        if (targetInst) return targetInst;
        for (var parentNode = targetNode.parentNode; parentNode; ) {
          if (targetInst = parentNode[internalContainerInstanceKey] || parentNode[internalInstanceKey]) {
            parentNode = targetInst.alternate;
            if (null !== targetInst.child || null !== parentNode && null !== parentNode.child)
              for (targetNode = getParentSuspenseInstance(targetNode); null !== targetNode; ) {
                if (parentNode = targetNode[internalInstanceKey]) return parentNode;
                targetNode = getParentSuspenseInstance(targetNode);
              }
            return targetInst;
          }
          targetNode = parentNode;
          parentNode = targetNode.parentNode;
        }
        return null;
      }
      function getInstanceFromNode(node) {
        if (node = node[internalInstanceKey] || node[internalContainerInstanceKey]) {
          var tag = node.tag;
          if (5 === tag || 6 === tag || 13 === tag || 26 === tag || 27 === tag || 3 === tag)
            return node;
        }
        return null;
      }
      function getNodeFromInstance(inst) {
        var tag = inst.tag;
        if (5 === tag || 26 === tag || 27 === tag || 6 === tag) return inst.stateNode;
        throw Error(formatProdErrorMessage(33));
      }
      function getResourcesFromRoot(root2) {
        var resources = root2[internalRootNodeResourcesKey];
        resources || (resources = root2[internalRootNodeResourcesKey] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() });
        return resources;
      }
      function markNodeAsHoistable(node) {
        node[internalHoistableMarker] = true;
      }
      var allNativeEvents = /* @__PURE__ */ new Set();
      var registrationNameDependencies = {};
      function registerTwoPhaseEvent(registrationName, dependencies) {
        registerDirectEvent(registrationName, dependencies);
        registerDirectEvent(registrationName + "Capture", dependencies);
      }
      function registerDirectEvent(registrationName, dependencies) {
        registrationNameDependencies[registrationName] = dependencies;
        for (registrationName = 0; registrationName < dependencies.length; registrationName++)
          allNativeEvents.add(dependencies[registrationName]);
      }
      var VALID_ATTRIBUTE_NAME_REGEX = RegExp(
        "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
      );
      var illegalAttributeNameCache = {};
      var validatedAttributeNameCache = {};
      function isAttributeNameSafe(attributeName) {
        if (hasOwnProperty2.call(validatedAttributeNameCache, attributeName))
          return true;
        if (hasOwnProperty2.call(illegalAttributeNameCache, attributeName)) return false;
        if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName))
          return validatedAttributeNameCache[attributeName] = true;
        illegalAttributeNameCache[attributeName] = true;
        return false;
      }
      function setValueForAttribute(node, name, value) {
        if (isAttributeNameSafe(name))
          if (null === value) node.removeAttribute(name);
          else {
            switch (typeof value) {
              case "undefined":
              case "function":
              case "symbol":
                node.removeAttribute(name);
                return;
              case "boolean":
                var prefix$8 = name.toLowerCase().slice(0, 5);
                if ("data-" !== prefix$8 && "aria-" !== prefix$8) {
                  node.removeAttribute(name);
                  return;
                }
            }
            node.setAttribute(name, "" + value);
          }
      }
      function setValueForKnownAttribute(node, name, value) {
        if (null === value) node.removeAttribute(name);
        else {
          switch (typeof value) {
            case "undefined":
            case "function":
            case "symbol":
            case "boolean":
              node.removeAttribute(name);
              return;
          }
          node.setAttribute(name, "" + value);
        }
      }
      function setValueForNamespacedAttribute(node, namespace, name, value) {
        if (null === value) node.removeAttribute(name);
        else {
          switch (typeof value) {
            case "undefined":
            case "function":
            case "symbol":
            case "boolean":
              node.removeAttribute(name);
              return;
          }
          node.setAttributeNS(namespace, name, "" + value);
        }
      }
      var prefix;
      var suffix;
      function describeBuiltInComponentFrame(name) {
        if (void 0 === prefix)
          try {
            throw Error();
          } catch (x) {
            var match = x.stack.trim().match(/\n( *(at )?)/);
            prefix = match && match[1] || "";
            suffix = -1 < x.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < x.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return "\n" + prefix + name + suffix;
      }
      var reentry = false;
      function describeNativeComponentFrame(fn, construct) {
        if (!fn || reentry) return "";
        reentry = true;
        var previousPrepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var RunInRootFrame = {
            DetermineComponentFrameRoot: function() {
              try {
                if (construct) {
                  var Fake = function() {
                    throw Error();
                  };
                  Object.defineProperty(Fake.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  });
                  if ("object" === typeof Reflect && Reflect.construct) {
                    try {
                      Reflect.construct(Fake, []);
                    } catch (x) {
                      var control = x;
                    }
                    Reflect.construct(fn, [], Fake);
                  } else {
                    try {
                      Fake.call();
                    } catch (x$9) {
                      control = x$9;
                    }
                    fn.call(Fake.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (x$10) {
                    control = x$10;
                  }
                  (Fake = fn()) && "function" === typeof Fake.catch && Fake.catch(function() {
                  });
                }
              } catch (sample) {
                if (sample && control && "string" === typeof sample.stack)
                  return [sample.stack, control.stack];
              }
              return [null, null];
            }
          };
          RunInRootFrame.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var namePropDescriptor = Object.getOwnPropertyDescriptor(
            RunInRootFrame.DetermineComponentFrameRoot,
            "name"
          );
          namePropDescriptor && namePropDescriptor.configurable && Object.defineProperty(
            RunInRootFrame.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var _RunInRootFrame$Deter = RunInRootFrame.DetermineComponentFrameRoot(), sampleStack = _RunInRootFrame$Deter[0], controlStack = _RunInRootFrame$Deter[1];
          if (sampleStack && controlStack) {
            var sampleLines = sampleStack.split("\n"), controlLines = controlStack.split("\n");
            for (namePropDescriptor = RunInRootFrame = 0; RunInRootFrame < sampleLines.length && !sampleLines[RunInRootFrame].includes("DetermineComponentFrameRoot"); )
              RunInRootFrame++;
            for (; namePropDescriptor < controlLines.length && !controlLines[namePropDescriptor].includes(
              "DetermineComponentFrameRoot"
            ); )
              namePropDescriptor++;
            if (RunInRootFrame === sampleLines.length || namePropDescriptor === controlLines.length)
              for (RunInRootFrame = sampleLines.length - 1, namePropDescriptor = controlLines.length - 1; 1 <= RunInRootFrame && 0 <= namePropDescriptor && sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]; )
                namePropDescriptor--;
            for (; 1 <= RunInRootFrame && 0 <= namePropDescriptor; RunInRootFrame--, namePropDescriptor--)
              if (sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
                if (1 !== RunInRootFrame || 1 !== namePropDescriptor) {
                  do
                    if (RunInRootFrame--, namePropDescriptor--, 0 > namePropDescriptor || sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
                      var frame = "\n" + sampleLines[RunInRootFrame].replace(" at new ", " at ");
                      fn.displayName && frame.includes("<anonymous>") && (frame = frame.replace("<anonymous>", fn.displayName));
                      return frame;
                    }
                  while (1 <= RunInRootFrame && 0 <= namePropDescriptor);
                }
                break;
              }
          }
        } finally {
          reentry = false, Error.prepareStackTrace = previousPrepareStackTrace;
        }
        return (previousPrepareStackTrace = fn ? fn.displayName || fn.name : "") ? describeBuiltInComponentFrame(previousPrepareStackTrace) : "";
      }
      function describeFiber(fiber) {
        switch (fiber.tag) {
          case 26:
          case 27:
          case 5:
            return describeBuiltInComponentFrame(fiber.type);
          case 16:
            return describeBuiltInComponentFrame("Lazy");
          case 13:
            return describeBuiltInComponentFrame("Suspense");
          case 19:
            return describeBuiltInComponentFrame("SuspenseList");
          case 0:
          case 15:
            return describeNativeComponentFrame(fiber.type, false);
          case 11:
            return describeNativeComponentFrame(fiber.type.render, false);
          case 1:
            return describeNativeComponentFrame(fiber.type, true);
          case 31:
            return describeBuiltInComponentFrame("Activity");
          default:
            return "";
        }
      }
      function getStackByFiberInDevAndProd(workInProgress2) {
        try {
          var info = "";
          do
            info += describeFiber(workInProgress2), workInProgress2 = workInProgress2.return;
          while (workInProgress2);
          return info;
        } catch (x) {
          return "\nError generating stack: " + x.message + "\n" + x.stack;
        }
      }
      function getToStringValue(value) {
        switch (typeof value) {
          case "bigint":
          case "boolean":
          case "number":
          case "string":
          case "undefined":
            return value;
          case "object":
            return value;
          default:
            return "";
        }
      }
      function isCheckable(elem) {
        var type = elem.type;
        return (elem = elem.nodeName) && "input" === elem.toLowerCase() && ("checkbox" === type || "radio" === type);
      }
      function trackValueOnNode(node) {
        var valueField = isCheckable(node) ? "checked" : "value", descriptor = Object.getOwnPropertyDescriptor(
          node.constructor.prototype,
          valueField
        ), currentValue = "" + node[valueField];
        if (!node.hasOwnProperty(valueField) && "undefined" !== typeof descriptor && "function" === typeof descriptor.get && "function" === typeof descriptor.set) {
          var get = descriptor.get, set = descriptor.set;
          Object.defineProperty(node, valueField, {
            configurable: true,
            get: function() {
              return get.call(this);
            },
            set: function(value) {
              currentValue = "" + value;
              set.call(this, value);
            }
          });
          Object.defineProperty(node, valueField, {
            enumerable: descriptor.enumerable
          });
          return {
            getValue: function() {
              return currentValue;
            },
            setValue: function(value) {
              currentValue = "" + value;
            },
            stopTracking: function() {
              node._valueTracker = null;
              delete node[valueField];
            }
          };
        }
      }
      function track(node) {
        node._valueTracker || (node._valueTracker = trackValueOnNode(node));
      }
      function updateValueIfChanged(node) {
        if (!node) return false;
        var tracker = node._valueTracker;
        if (!tracker) return true;
        var lastValue = tracker.getValue();
        var value = "";
        node && (value = isCheckable(node) ? node.checked ? "true" : "false" : node.value);
        node = value;
        return node !== lastValue ? (tracker.setValue(node), true) : false;
      }
      function getActiveElement(doc) {
        doc = doc || ("undefined" !== typeof document ? document : void 0);
        if ("undefined" === typeof doc) return null;
        try {
          return doc.activeElement || doc.body;
        } catch (e) {
          return doc.body;
        }
      }
      var escapeSelectorAttributeValueInsideDoubleQuotesRegex = /[\n"\\]/g;
      function escapeSelectorAttributeValueInsideDoubleQuotes(value) {
        return value.replace(
          escapeSelectorAttributeValueInsideDoubleQuotesRegex,
          function(ch) {
            return "\\" + ch.charCodeAt(0).toString(16) + " ";
          }
        );
      }
      function updateInput(element, value, defaultValue, lastDefaultValue, checked, defaultChecked, type, name) {
        element.name = "";
        null != type && "function" !== typeof type && "symbol" !== typeof type && "boolean" !== typeof type ? element.type = type : element.removeAttribute("type");
        if (null != value)
          if ("number" === type) {
            if (0 === value && "" === element.value || element.value != value)
              element.value = "" + getToStringValue(value);
          } else
            element.value !== "" + getToStringValue(value) && (element.value = "" + getToStringValue(value));
        else
          "submit" !== type && "reset" !== type || element.removeAttribute("value");
        null != value ? setDefaultValue(element, type, getToStringValue(value)) : null != defaultValue ? setDefaultValue(element, type, getToStringValue(defaultValue)) : null != lastDefaultValue && element.removeAttribute("value");
        null == checked && null != defaultChecked && (element.defaultChecked = !!defaultChecked);
        null != checked && (element.checked = checked && "function" !== typeof checked && "symbol" !== typeof checked);
        null != name && "function" !== typeof name && "symbol" !== typeof name && "boolean" !== typeof name ? element.name = "" + getToStringValue(name) : element.removeAttribute("name");
      }
      function initInput(element, value, defaultValue, checked, defaultChecked, type, name, isHydrating2) {
        null != type && "function" !== typeof type && "symbol" !== typeof type && "boolean" !== typeof type && (element.type = type);
        if (null != value || null != defaultValue) {
          if (!("submit" !== type && "reset" !== type || void 0 !== value && null !== value))
            return;
          defaultValue = null != defaultValue ? "" + getToStringValue(defaultValue) : "";
          value = null != value ? "" + getToStringValue(value) : defaultValue;
          isHydrating2 || value === element.value || (element.value = value);
          element.defaultValue = value;
        }
        checked = null != checked ? checked : defaultChecked;
        checked = "function" !== typeof checked && "symbol" !== typeof checked && !!checked;
        element.checked = isHydrating2 ? element.checked : !!checked;
        element.defaultChecked = !!checked;
        null != name && "function" !== typeof name && "symbol" !== typeof name && "boolean" !== typeof name && (element.name = name);
      }
      function setDefaultValue(node, type, value) {
        "number" === type && getActiveElement(node.ownerDocument) === node || node.defaultValue === "" + value || (node.defaultValue = "" + value);
      }
      function updateOptions(node, multiple, propValue, setDefaultSelected) {
        node = node.options;
        if (multiple) {
          multiple = {};
          for (var i = 0; i < propValue.length; i++)
            multiple["$" + propValue[i]] = true;
          for (propValue = 0; propValue < node.length; propValue++)
            i = multiple.hasOwnProperty("$" + node[propValue].value), node[propValue].selected !== i && (node[propValue].selected = i), i && setDefaultSelected && (node[propValue].defaultSelected = true);
        } else {
          propValue = "" + getToStringValue(propValue);
          multiple = null;
          for (i = 0; i < node.length; i++) {
            if (node[i].value === propValue) {
              node[i].selected = true;
              setDefaultSelected && (node[i].defaultSelected = true);
              return;
            }
            null !== multiple || node[i].disabled || (multiple = node[i]);
          }
          null !== multiple && (multiple.selected = true);
        }
      }
      function updateTextarea(element, value, defaultValue) {
        if (null != value && (value = "" + getToStringValue(value), value !== element.value && (element.value = value), null == defaultValue)) {
          element.defaultValue !== value && (element.defaultValue = value);
          return;
        }
        element.defaultValue = null != defaultValue ? "" + getToStringValue(defaultValue) : "";
      }
      function initTextarea(element, value, defaultValue, children) {
        if (null == value) {
          if (null != children) {
            if (null != defaultValue) throw Error(formatProdErrorMessage(92));
            if (isArrayImpl(children)) {
              if (1 < children.length) throw Error(formatProdErrorMessage(93));
              children = children[0];
            }
            defaultValue = children;
          }
          null == defaultValue && (defaultValue = "");
          value = defaultValue;
        }
        defaultValue = getToStringValue(value);
        element.defaultValue = defaultValue;
        children = element.textContent;
        children === defaultValue && "" !== children && null !== children && (element.value = children);
      }
      function setTextContent(node, text) {
        if (text) {
          var firstChild = node.firstChild;
          if (firstChild && firstChild === node.lastChild && 3 === firstChild.nodeType) {
            firstChild.nodeValue = text;
            return;
          }
        }
        node.textContent = text;
      }
      var unitlessNumbers3 = new Set(
        "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
          " "
        )
      );
      function setValueForStyle(style2, styleName, value) {
        var isCustomProperty = 0 === styleName.indexOf("--");
        null == value || "boolean" === typeof value || "" === value ? isCustomProperty ? style2.setProperty(styleName, "") : "float" === styleName ? style2.cssFloat = "" : style2[styleName] = "" : isCustomProperty ? style2.setProperty(styleName, value) : "number" !== typeof value || 0 === value || unitlessNumbers3.has(styleName) ? "float" === styleName ? style2.cssFloat = value : style2[styleName] = ("" + value).trim() : style2[styleName] = value + "px";
      }
      function setValueForStyles2(node, styles16, prevStyles) {
        if (null != styles16 && "object" !== typeof styles16)
          throw Error(formatProdErrorMessage(62));
        node = node.style;
        if (null != prevStyles) {
          for (var styleName in prevStyles)
            !prevStyles.hasOwnProperty(styleName) || null != styles16 && styles16.hasOwnProperty(styleName) || (0 === styleName.indexOf("--") ? node.setProperty(styleName, "") : "float" === styleName ? node.cssFloat = "" : node[styleName] = "");
          for (var styleName$16 in styles16)
            styleName = styles16[styleName$16], styles16.hasOwnProperty(styleName$16) && prevStyles[styleName$16] !== styleName && setValueForStyle(node, styleName$16, styleName);
        } else
          for (var styleName$17 in styles16)
            styles16.hasOwnProperty(styleName$17) && setValueForStyle(node, styleName$17, styles16[styleName$17]);
      }
      function isCustomElement(tagName) {
        if (-1 === tagName.indexOf("-")) return false;
        switch (tagName) {
          case "annotation-xml":
          case "color-profile":
          case "font-face":
          case "font-face-src":
          case "font-face-uri":
          case "font-face-format":
          case "font-face-name":
          case "missing-glyph":
            return false;
          default:
            return true;
        }
      }
      var aliases = /* @__PURE__ */ new Map([
        ["acceptCharset", "accept-charset"],
        ["htmlFor", "for"],
        ["httpEquiv", "http-equiv"],
        ["crossOrigin", "crossorigin"],
        ["accentHeight", "accent-height"],
        ["alignmentBaseline", "alignment-baseline"],
        ["arabicForm", "arabic-form"],
        ["baselineShift", "baseline-shift"],
        ["capHeight", "cap-height"],
        ["clipPath", "clip-path"],
        ["clipRule", "clip-rule"],
        ["colorInterpolation", "color-interpolation"],
        ["colorInterpolationFilters", "color-interpolation-filters"],
        ["colorProfile", "color-profile"],
        ["colorRendering", "color-rendering"],
        ["dominantBaseline", "dominant-baseline"],
        ["enableBackground", "enable-background"],
        ["fillOpacity", "fill-opacity"],
        ["fillRule", "fill-rule"],
        ["floodColor", "flood-color"],
        ["floodOpacity", "flood-opacity"],
        ["fontFamily", "font-family"],
        ["fontSize", "font-size"],
        ["fontSizeAdjust", "font-size-adjust"],
        ["fontStretch", "font-stretch"],
        ["fontStyle", "font-style"],
        ["fontVariant", "font-variant"],
        ["fontWeight", "font-weight"],
        ["glyphName", "glyph-name"],
        ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
        ["glyphOrientationVertical", "glyph-orientation-vertical"],
        ["horizAdvX", "horiz-adv-x"],
        ["horizOriginX", "horiz-origin-x"],
        ["imageRendering", "image-rendering"],
        ["letterSpacing", "letter-spacing"],
        ["lightingColor", "lighting-color"],
        ["markerEnd", "marker-end"],
        ["markerMid", "marker-mid"],
        ["markerStart", "marker-start"],
        ["overlinePosition", "overline-position"],
        ["overlineThickness", "overline-thickness"],
        ["paintOrder", "paint-order"],
        ["panose-1", "panose-1"],
        ["pointerEvents", "pointer-events"],
        ["renderingIntent", "rendering-intent"],
        ["shapeRendering", "shape-rendering"],
        ["stopColor", "stop-color"],
        ["stopOpacity", "stop-opacity"],
        ["strikethroughPosition", "strikethrough-position"],
        ["strikethroughThickness", "strikethrough-thickness"],
        ["strokeDasharray", "stroke-dasharray"],
        ["strokeDashoffset", "stroke-dashoffset"],
        ["strokeLinecap", "stroke-linecap"],
        ["strokeLinejoin", "stroke-linejoin"],
        ["strokeMiterlimit", "stroke-miterlimit"],
        ["strokeOpacity", "stroke-opacity"],
        ["strokeWidth", "stroke-width"],
        ["textAnchor", "text-anchor"],
        ["textDecoration", "text-decoration"],
        ["textRendering", "text-rendering"],
        ["transformOrigin", "transform-origin"],
        ["underlinePosition", "underline-position"],
        ["underlineThickness", "underline-thickness"],
        ["unicodeBidi", "unicode-bidi"],
        ["unicodeRange", "unicode-range"],
        ["unitsPerEm", "units-per-em"],
        ["vAlphabetic", "v-alphabetic"],
        ["vHanging", "v-hanging"],
        ["vIdeographic", "v-ideographic"],
        ["vMathematical", "v-mathematical"],
        ["vectorEffect", "vector-effect"],
        ["vertAdvY", "vert-adv-y"],
        ["vertOriginX", "vert-origin-x"],
        ["vertOriginY", "vert-origin-y"],
        ["wordSpacing", "word-spacing"],
        ["writingMode", "writing-mode"],
        ["xmlnsXlink", "xmlns:xlink"],
        ["xHeight", "x-height"]
      ]);
      var isJavaScriptProtocol = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
      function sanitizeURL(url) {
        return isJavaScriptProtocol.test("" + url) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : url;
      }
      var currentReplayingEvent = null;
      function getEventTarget(nativeEvent) {
        nativeEvent = nativeEvent.target || nativeEvent.srcElement || window;
        nativeEvent.correspondingUseElement && (nativeEvent = nativeEvent.correspondingUseElement);
        return 3 === nativeEvent.nodeType ? nativeEvent.parentNode : nativeEvent;
      }
      var restoreTarget = null;
      var restoreQueue = null;
      function restoreStateOfTarget(target) {
        var internalInstance = getInstanceFromNode(target);
        if (internalInstance && (target = internalInstance.stateNode)) {
          var props = target[internalPropsKey] || null;
          a: switch (target = internalInstance.stateNode, internalInstance.type) {
            case "input":
              updateInput(
                target,
                props.value,
                props.defaultValue,
                props.defaultValue,
                props.checked,
                props.defaultChecked,
                props.type,
                props.name
              );
              internalInstance = props.name;
              if ("radio" === props.type && null != internalInstance) {
                for (props = target; props.parentNode; ) props = props.parentNode;
                props = props.querySelectorAll(
                  'input[name="' + escapeSelectorAttributeValueInsideDoubleQuotes(
                    "" + internalInstance
                  ) + '"][type="radio"]'
                );
                for (internalInstance = 0; internalInstance < props.length; internalInstance++) {
                  var otherNode = props[internalInstance];
                  if (otherNode !== target && otherNode.form === target.form) {
                    var otherProps = otherNode[internalPropsKey] || null;
                    if (!otherProps) throw Error(formatProdErrorMessage(90));
                    updateInput(
                      otherNode,
                      otherProps.value,
                      otherProps.defaultValue,
                      otherProps.defaultValue,
                      otherProps.checked,
                      otherProps.defaultChecked,
                      otherProps.type,
                      otherProps.name
                    );
                  }
                }
                for (internalInstance = 0; internalInstance < props.length; internalInstance++)
                  otherNode = props[internalInstance], otherNode.form === target.form && updateValueIfChanged(otherNode);
              }
              break a;
            case "textarea":
              updateTextarea(target, props.value, props.defaultValue);
              break a;
            case "select":
              internalInstance = props.value, null != internalInstance && updateOptions(target, !!props.multiple, internalInstance, false);
          }
        }
      }
      var isInsideEventHandler = false;
      function batchedUpdates$1(fn, a, b) {
        if (isInsideEventHandler) return fn(a, b);
        isInsideEventHandler = true;
        try {
          var JSCompiler_inline_result = fn(a);
          return JSCompiler_inline_result;
        } finally {
          if (isInsideEventHandler = false, null !== restoreTarget || null !== restoreQueue) {
            if (flushSyncWork$1(), restoreTarget && (a = restoreTarget, fn = restoreQueue, restoreQueue = restoreTarget = null, restoreStateOfTarget(a), fn))
              for (a = 0; a < fn.length; a++) restoreStateOfTarget(fn[a]);
          }
        }
      }
      function getListener(inst, registrationName) {
        var stateNode = inst.stateNode;
        if (null === stateNode) return null;
        var props = stateNode[internalPropsKey] || null;
        if (null === props) return null;
        stateNode = props[registrationName];
        a: switch (registrationName) {
          case "onClick":
          case "onClickCapture":
          case "onDoubleClick":
          case "onDoubleClickCapture":
          case "onMouseDown":
          case "onMouseDownCapture":
          case "onMouseMove":
          case "onMouseMoveCapture":
          case "onMouseUp":
          case "onMouseUpCapture":
          case "onMouseEnter":
            (props = !props.disabled) || (inst = inst.type, props = !("button" === inst || "input" === inst || "select" === inst || "textarea" === inst));
            inst = !props;
            break a;
          default:
            inst = false;
        }
        if (inst) return null;
        if (stateNode && "function" !== typeof stateNode)
          throw Error(
            formatProdErrorMessage(231, registrationName, typeof stateNode)
          );
        return stateNode;
      }
      var canUseDOM2 = !("undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement);
      var passiveBrowserEventsSupported = false;
      if (canUseDOM2)
        try {
          options = {};
          Object.defineProperty(options, "passive", {
            get: function() {
              passiveBrowserEventsSupported = true;
            }
          });
          window.addEventListener("test", options, options);
          window.removeEventListener("test", options, options);
        } catch (e) {
          passiveBrowserEventsSupported = false;
        }
      var options;
      var root = null;
      var startText = null;
      var fallbackText = null;
      function getData() {
        if (fallbackText) return fallbackText;
        var start, startValue = startText, startLength = startValue.length, end, endValue = "value" in root ? root.value : root.textContent, endLength = endValue.length;
        for (start = 0; start < startLength && startValue[start] === endValue[start]; start++) ;
        var minEnd = startLength - start;
        for (end = 1; end <= minEnd && startValue[startLength - end] === endValue[endLength - end]; end++) ;
        return fallbackText = endValue.slice(start, 1 < end ? 1 - end : void 0);
      }
      function getEventCharCode(nativeEvent) {
        var keyCode = nativeEvent.keyCode;
        "charCode" in nativeEvent ? (nativeEvent = nativeEvent.charCode, 0 === nativeEvent && 13 === keyCode && (nativeEvent = 13)) : nativeEvent = keyCode;
        10 === nativeEvent && (nativeEvent = 13);
        return 32 <= nativeEvent || 13 === nativeEvent ? nativeEvent : 0;
      }
      function functionThatReturnsTrue() {
        return true;
      }
      function functionThatReturnsFalse() {
        return false;
      }
      function createSyntheticEvent(Interface) {
        function SyntheticBaseEvent(reactName, reactEventType, targetInst, nativeEvent, nativeEventTarget) {
          this._reactName = reactName;
          this._targetInst = targetInst;
          this.type = reactEventType;
          this.nativeEvent = nativeEvent;
          this.target = nativeEventTarget;
          this.currentTarget = null;
          for (var propName in Interface)
            Interface.hasOwnProperty(propName) && (reactName = Interface[propName], this[propName] = reactName ? reactName(nativeEvent) : nativeEvent[propName]);
          this.isDefaultPrevented = (null != nativeEvent.defaultPrevented ? nativeEvent.defaultPrevented : false === nativeEvent.returnValue) ? functionThatReturnsTrue : functionThatReturnsFalse;
          this.isPropagationStopped = functionThatReturnsFalse;
          return this;
        }
        assign(SyntheticBaseEvent.prototype, {
          preventDefault: function() {
            this.defaultPrevented = true;
            var event = this.nativeEvent;
            event && (event.preventDefault ? event.preventDefault() : "unknown" !== typeof event.returnValue && (event.returnValue = false), this.isDefaultPrevented = functionThatReturnsTrue);
          },
          stopPropagation: function() {
            var event = this.nativeEvent;
            event && (event.stopPropagation ? event.stopPropagation() : "unknown" !== typeof event.cancelBubble && (event.cancelBubble = true), this.isPropagationStopped = functionThatReturnsTrue);
          },
          persist: function() {
          },
          isPersistent: functionThatReturnsTrue
        });
        return SyntheticBaseEvent;
      }
      var EventInterface = {
        eventPhase: 0,
        bubbles: 0,
        cancelable: 0,
        timeStamp: function(event) {
          return event.timeStamp || Date.now();
        },
        defaultPrevented: 0,
        isTrusted: 0
      };
      var SyntheticEvent = createSyntheticEvent(EventInterface);
      var UIEventInterface = assign({}, EventInterface, { view: 0, detail: 0 });
      var SyntheticUIEvent = createSyntheticEvent(UIEventInterface);
      var lastMovementX;
      var lastMovementY;
      var lastMouseEvent;
      var MouseEventInterface = assign({}, UIEventInterface, {
        screenX: 0,
        screenY: 0,
        clientX: 0,
        clientY: 0,
        pageX: 0,
        pageY: 0,
        ctrlKey: 0,
        shiftKey: 0,
        altKey: 0,
        metaKey: 0,
        getModifierState: getEventModifierState,
        button: 0,
        buttons: 0,
        relatedTarget: function(event) {
          return void 0 === event.relatedTarget ? event.fromElement === event.srcElement ? event.toElement : event.fromElement : event.relatedTarget;
        },
        movementX: function(event) {
          if ("movementX" in event) return event.movementX;
          event !== lastMouseEvent && (lastMouseEvent && "mousemove" === event.type ? (lastMovementX = event.screenX - lastMouseEvent.screenX, lastMovementY = event.screenY - lastMouseEvent.screenY) : lastMovementY = lastMovementX = 0, lastMouseEvent = event);
          return lastMovementX;
        },
        movementY: function(event) {
          return "movementY" in event ? event.movementY : lastMovementY;
        }
      });
      var SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface);
      var DragEventInterface = assign({}, MouseEventInterface, { dataTransfer: 0 });
      var SyntheticDragEvent = createSyntheticEvent(DragEventInterface);
      var FocusEventInterface = assign({}, UIEventInterface, { relatedTarget: 0 });
      var SyntheticFocusEvent = createSyntheticEvent(FocusEventInterface);
      var AnimationEventInterface = assign({}, EventInterface, {
        animationName: 0,
        elapsedTime: 0,
        pseudoElement: 0
      });
      var SyntheticAnimationEvent = createSyntheticEvent(AnimationEventInterface);
      var ClipboardEventInterface = assign({}, EventInterface, {
        clipboardData: function(event) {
          return "clipboardData" in event ? event.clipboardData : window.clipboardData;
        }
      });
      var SyntheticClipboardEvent = createSyntheticEvent(ClipboardEventInterface);
      var CompositionEventInterface = assign({}, EventInterface, { data: 0 });
      var SyntheticCompositionEvent = createSyntheticEvent(CompositionEventInterface);
      var normalizeKey = {
        Esc: "Escape",
        Spacebar: " ",
        Left: "ArrowLeft",
        Up: "ArrowUp",
        Right: "ArrowRight",
        Down: "ArrowDown",
        Del: "Delete",
        Win: "OS",
        Menu: "ContextMenu",
        Apps: "ContextMenu",
        Scroll: "ScrollLock",
        MozPrintableKey: "Unidentified"
      };
      var translateToKey = {
        8: "Backspace",
        9: "Tab",
        12: "Clear",
        13: "Enter",
        16: "Shift",
        17: "Control",
        18: "Alt",
        19: "Pause",
        20: "CapsLock",
        27: "Escape",
        32: " ",
        33: "PageUp",
        34: "PageDown",
        35: "End",
        36: "Home",
        37: "ArrowLeft",
        38: "ArrowUp",
        39: "ArrowRight",
        40: "ArrowDown",
        45: "Insert",
        46: "Delete",
        112: "F1",
        113: "F2",
        114: "F3",
        115: "F4",
        116: "F5",
        117: "F6",
        118: "F7",
        119: "F8",
        120: "F9",
        121: "F10",
        122: "F11",
        123: "F12",
        144: "NumLock",
        145: "ScrollLock",
        224: "Meta"
      };
      var modifierKeyToProp = {
        Alt: "altKey",
        Control: "ctrlKey",
        Meta: "metaKey",
        Shift: "shiftKey"
      };
      function modifierStateGetter(keyArg) {
        var nativeEvent = this.nativeEvent;
        return nativeEvent.getModifierState ? nativeEvent.getModifierState(keyArg) : (keyArg = modifierKeyToProp[keyArg]) ? !!nativeEvent[keyArg] : false;
      }
      function getEventModifierState() {
        return modifierStateGetter;
      }
      var KeyboardEventInterface = assign({}, UIEventInterface, {
        key: function(nativeEvent) {
          if (nativeEvent.key) {
            var key = normalizeKey[nativeEvent.key] || nativeEvent.key;
            if ("Unidentified" !== key) return key;
          }
          return "keypress" === nativeEvent.type ? (nativeEvent = getEventCharCode(nativeEvent), 13 === nativeEvent ? "Enter" : String.fromCharCode(nativeEvent)) : "keydown" === nativeEvent.type || "keyup" === nativeEvent.type ? translateToKey[nativeEvent.keyCode] || "Unidentified" : "";
        },
        code: 0,
        location: 0,
        ctrlKey: 0,
        shiftKey: 0,
        altKey: 0,
        metaKey: 0,
        repeat: 0,
        locale: 0,
        getModifierState: getEventModifierState,
        charCode: function(event) {
          return "keypress" === event.type ? getEventCharCode(event) : 0;
        },
        keyCode: function(event) {
          return "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
        },
        which: function(event) {
          return "keypress" === event.type ? getEventCharCode(event) : "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
        }
      });
      var SyntheticKeyboardEvent = createSyntheticEvent(KeyboardEventInterface);
      var PointerEventInterface = assign({}, MouseEventInterface, {
        pointerId: 0,
        width: 0,
        height: 0,
        pressure: 0,
        tangentialPressure: 0,
        tiltX: 0,
        tiltY: 0,
        twist: 0,
        pointerType: 0,
        isPrimary: 0
      });
      var SyntheticPointerEvent = createSyntheticEvent(PointerEventInterface);
      var TouchEventInterface = assign({}, UIEventInterface, {
        touches: 0,
        targetTouches: 0,
        changedTouches: 0,
        altKey: 0,
        metaKey: 0,
        ctrlKey: 0,
        shiftKey: 0,
        getModifierState: getEventModifierState
      });
      var SyntheticTouchEvent = createSyntheticEvent(TouchEventInterface);
      var TransitionEventInterface = assign({}, EventInterface, {
        propertyName: 0,
        elapsedTime: 0,
        pseudoElement: 0
      });
      var SyntheticTransitionEvent = createSyntheticEvent(TransitionEventInterface);
      var WheelEventInterface = assign({}, MouseEventInterface, {
        deltaX: function(event) {
          return "deltaX" in event ? event.deltaX : "wheelDeltaX" in event ? -event.wheelDeltaX : 0;
        },
        deltaY: function(event) {
          return "deltaY" in event ? event.deltaY : "wheelDeltaY" in event ? -event.wheelDeltaY : "wheelDelta" in event ? -event.wheelDelta : 0;
        },
        deltaZ: 0,
        deltaMode: 0
      });
      var SyntheticWheelEvent = createSyntheticEvent(WheelEventInterface);
      var ToggleEventInterface = assign({}, EventInterface, {
        newState: 0,
        oldState: 0
      });
      var SyntheticToggleEvent = createSyntheticEvent(ToggleEventInterface);
      var END_KEYCODES = [9, 13, 27, 32];
      var canUseCompositionEvent = canUseDOM2 && "CompositionEvent" in window;
      var documentMode = null;
      canUseDOM2 && "documentMode" in document && (documentMode = document.documentMode);
      var canUseTextInputEvent = canUseDOM2 && "TextEvent" in window && !documentMode;
      var useFallbackCompositionData = canUseDOM2 && (!canUseCompositionEvent || documentMode && 8 < documentMode && 11 >= documentMode);
      var SPACEBAR_CHAR = String.fromCharCode(32);
      var hasSpaceKeypress = false;
      function isFallbackCompositionEnd(domEventName, nativeEvent) {
        switch (domEventName) {
          case "keyup":
            return -1 !== END_KEYCODES.indexOf(nativeEvent.keyCode);
          case "keydown":
            return 229 !== nativeEvent.keyCode;
          case "keypress":
          case "mousedown":
          case "focusout":
            return true;
          default:
            return false;
        }
      }
      function getDataFromCustomEvent(nativeEvent) {
        nativeEvent = nativeEvent.detail;
        return "object" === typeof nativeEvent && "data" in nativeEvent ? nativeEvent.data : null;
      }
      var isComposing = false;
      function getNativeBeforeInputChars(domEventName, nativeEvent) {
        switch (domEventName) {
          case "compositionend":
            return getDataFromCustomEvent(nativeEvent);
          case "keypress":
            if (32 !== nativeEvent.which) return null;
            hasSpaceKeypress = true;
            return SPACEBAR_CHAR;
          case "textInput":
            return domEventName = nativeEvent.data, domEventName === SPACEBAR_CHAR && hasSpaceKeypress ? null : domEventName;
          default:
            return null;
        }
      }
      function getFallbackBeforeInputChars(domEventName, nativeEvent) {
        if (isComposing)
          return "compositionend" === domEventName || !canUseCompositionEvent && isFallbackCompositionEnd(domEventName, nativeEvent) ? (domEventName = getData(), fallbackText = startText = root = null, isComposing = false, domEventName) : null;
        switch (domEventName) {
          case "paste":
            return null;
          case "keypress":
            if (!(nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) || nativeEvent.ctrlKey && nativeEvent.altKey) {
              if (nativeEvent.char && 1 < nativeEvent.char.length)
                return nativeEvent.char;
              if (nativeEvent.which) return String.fromCharCode(nativeEvent.which);
            }
            return null;
          case "compositionend":
            return useFallbackCompositionData && "ko" !== nativeEvent.locale ? null : nativeEvent.data;
          default:
            return null;
        }
      }
      var supportedInputTypes = {
        color: true,
        date: true,
        datetime: true,
        "datetime-local": true,
        email: true,
        month: true,
        number: true,
        password: true,
        range: true,
        search: true,
        tel: true,
        text: true,
        time: true,
        url: true,
        week: true
      };
      function isTextInputElement(elem) {
        var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
        return "input" === nodeName ? !!supportedInputTypes[elem.type] : "textarea" === nodeName ? true : false;
      }
      function createAndAccumulateChangeEvent(dispatchQueue, inst, nativeEvent, target) {
        restoreTarget ? restoreQueue ? restoreQueue.push(target) : restoreQueue = [target] : restoreTarget = target;
        inst = accumulateTwoPhaseListeners(inst, "onChange");
        0 < inst.length && (nativeEvent = new SyntheticEvent(
          "onChange",
          "change",
          null,
          nativeEvent,
          target
        ), dispatchQueue.push({ event: nativeEvent, listeners: inst }));
      }
      var activeElement$1 = null;
      var activeElementInst$1 = null;
      function runEventInBatch(dispatchQueue) {
        processDispatchQueue(dispatchQueue, 0);
      }
      function getInstIfValueChanged(targetInst) {
        var targetNode = getNodeFromInstance(targetInst);
        if (updateValueIfChanged(targetNode)) return targetInst;
      }
      function getTargetInstForChangeEvent(domEventName, targetInst) {
        if ("change" === domEventName) return targetInst;
      }
      var isInputEventSupported = false;
      if (canUseDOM2) {
        if (canUseDOM2) {
          isSupported$jscomp$inline_417 = "oninput" in document;
          if (!isSupported$jscomp$inline_417) {
            element$jscomp$inline_418 = document.createElement("div");
            element$jscomp$inline_418.setAttribute("oninput", "return;");
            isSupported$jscomp$inline_417 = "function" === typeof element$jscomp$inline_418.oninput;
          }
          JSCompiler_inline_result$jscomp$282 = isSupported$jscomp$inline_417;
        } else JSCompiler_inline_result$jscomp$282 = false;
        isInputEventSupported = JSCompiler_inline_result$jscomp$282 && (!document.documentMode || 9 < document.documentMode);
      }
      var JSCompiler_inline_result$jscomp$282;
      var isSupported$jscomp$inline_417;
      var element$jscomp$inline_418;
      function stopWatchingForValueChange() {
        activeElement$1 && (activeElement$1.detachEvent("onpropertychange", handlePropertyChange), activeElementInst$1 = activeElement$1 = null);
      }
      function handlePropertyChange(nativeEvent) {
        if ("value" === nativeEvent.propertyName && getInstIfValueChanged(activeElementInst$1)) {
          var dispatchQueue = [];
          createAndAccumulateChangeEvent(
            dispatchQueue,
            activeElementInst$1,
            nativeEvent,
            getEventTarget(nativeEvent)
          );
          batchedUpdates$1(runEventInBatch, dispatchQueue);
        }
      }
      function handleEventsForInputEventPolyfill(domEventName, target, targetInst) {
        "focusin" === domEventName ? (stopWatchingForValueChange(), activeElement$1 = target, activeElementInst$1 = targetInst, activeElement$1.attachEvent("onpropertychange", handlePropertyChange)) : "focusout" === domEventName && stopWatchingForValueChange();
      }
      function getTargetInstForInputEventPolyfill(domEventName) {
        if ("selectionchange" === domEventName || "keyup" === domEventName || "keydown" === domEventName)
          return getInstIfValueChanged(activeElementInst$1);
      }
      function getTargetInstForClickEvent(domEventName, targetInst) {
        if ("click" === domEventName) return getInstIfValueChanged(targetInst);
      }
      function getTargetInstForInputOrChangeEvent(domEventName, targetInst) {
        if ("input" === domEventName || "change" === domEventName)
          return getInstIfValueChanged(targetInst);
      }
      function is(x, y) {
        return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
      }
      var objectIs = "function" === typeof Object.is ? Object.is : is;
      function shallowEqual(objA, objB) {
        if (objectIs(objA, objB)) return true;
        if ("object" !== typeof objA || null === objA || "object" !== typeof objB || null === objB)
          return false;
        var keysA = Object.keys(objA), keysB = Object.keys(objB);
        if (keysA.length !== keysB.length) return false;
        for (keysB = 0; keysB < keysA.length; keysB++) {
          var currentKey = keysA[keysB];
          if (!hasOwnProperty2.call(objB, currentKey) || !objectIs(objA[currentKey], objB[currentKey]))
            return false;
        }
        return true;
      }
      function getLeafNode(node) {
        for (; node && node.firstChild; ) node = node.firstChild;
        return node;
      }
      function getNodeForCharacterOffset(root2, offset) {
        var node = getLeafNode(root2);
        root2 = 0;
        for (var nodeEnd; node; ) {
          if (3 === node.nodeType) {
            nodeEnd = root2 + node.textContent.length;
            if (root2 <= offset && nodeEnd >= offset)
              return { node, offset: offset - root2 };
            root2 = nodeEnd;
          }
          a: {
            for (; node; ) {
              if (node.nextSibling) {
                node = node.nextSibling;
                break a;
              }
              node = node.parentNode;
            }
            node = void 0;
          }
          node = getLeafNode(node);
        }
      }
      function containsNode(outerNode, innerNode) {
        return outerNode && innerNode ? outerNode === innerNode ? true : outerNode && 3 === outerNode.nodeType ? false : innerNode && 3 === innerNode.nodeType ? containsNode(outerNode, innerNode.parentNode) : "contains" in outerNode ? outerNode.contains(innerNode) : outerNode.compareDocumentPosition ? !!(outerNode.compareDocumentPosition(innerNode) & 16) : false : false;
      }
      function getActiveElementDeep(containerInfo) {
        containerInfo = null != containerInfo && null != containerInfo.ownerDocument && null != containerInfo.ownerDocument.defaultView ? containerInfo.ownerDocument.defaultView : window;
        for (var element = getActiveElement(containerInfo.document); element instanceof containerInfo.HTMLIFrameElement; ) {
          try {
            var JSCompiler_inline_result = "string" === typeof element.contentWindow.location.href;
          } catch (err) {
            JSCompiler_inline_result = false;
          }
          if (JSCompiler_inline_result) containerInfo = element.contentWindow;
          else break;
          element = getActiveElement(containerInfo.document);
        }
        return element;
      }
      function hasSelectionCapabilities(elem) {
        var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
        return nodeName && ("input" === nodeName && ("text" === elem.type || "search" === elem.type || "tel" === elem.type || "url" === elem.type || "password" === elem.type) || "textarea" === nodeName || "true" === elem.contentEditable);
      }
      var skipSelectionChangeEvent = canUseDOM2 && "documentMode" in document && 11 >= document.documentMode;
      var activeElement = null;
      var activeElementInst = null;
      var lastSelection = null;
      var mouseDown = false;
      function constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget) {
        var doc = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget.document : 9 === nativeEventTarget.nodeType ? nativeEventTarget : nativeEventTarget.ownerDocument;
        mouseDown || null == activeElement || activeElement !== getActiveElement(doc) || (doc = activeElement, "selectionStart" in doc && hasSelectionCapabilities(doc) ? doc = { start: doc.selectionStart, end: doc.selectionEnd } : (doc = (doc.ownerDocument && doc.ownerDocument.defaultView || window).getSelection(), doc = {
          anchorNode: doc.anchorNode,
          anchorOffset: doc.anchorOffset,
          focusNode: doc.focusNode,
          focusOffset: doc.focusOffset
        }), lastSelection && shallowEqual(lastSelection, doc) || (lastSelection = doc, doc = accumulateTwoPhaseListeners(activeElementInst, "onSelect"), 0 < doc.length && (nativeEvent = new SyntheticEvent(
          "onSelect",
          "select",
          null,
          nativeEvent,
          nativeEventTarget
        ), dispatchQueue.push({ event: nativeEvent, listeners: doc }), nativeEvent.target = activeElement)));
      }
      function makePrefixMap(styleProp, eventName) {
        var prefixes3 = {};
        prefixes3[styleProp.toLowerCase()] = eventName.toLowerCase();
        prefixes3["Webkit" + styleProp] = "webkit" + eventName;
        prefixes3["Moz" + styleProp] = "moz" + eventName;
        return prefixes3;
      }
      var vendorPrefixes = {
        animationend: makePrefixMap("Animation", "AnimationEnd"),
        animationiteration: makePrefixMap("Animation", "AnimationIteration"),
        animationstart: makePrefixMap("Animation", "AnimationStart"),
        transitionrun: makePrefixMap("Transition", "TransitionRun"),
        transitionstart: makePrefixMap("Transition", "TransitionStart"),
        transitioncancel: makePrefixMap("Transition", "TransitionCancel"),
        transitionend: makePrefixMap("Transition", "TransitionEnd")
      };
      var prefixedEventNames = {};
      var style = {};
      canUseDOM2 && (style = document.createElement("div").style, "AnimationEvent" in window || (delete vendorPrefixes.animationend.animation, delete vendorPrefixes.animationiteration.animation, delete vendorPrefixes.animationstart.animation), "TransitionEvent" in window || delete vendorPrefixes.transitionend.transition);
      function getVendorPrefixedEventName(eventName) {
        if (prefixedEventNames[eventName]) return prefixedEventNames[eventName];
        if (!vendorPrefixes[eventName]) return eventName;
        var prefixMap = vendorPrefixes[eventName], styleProp;
        for (styleProp in prefixMap)
          if (prefixMap.hasOwnProperty(styleProp) && styleProp in style)
            return prefixedEventNames[eventName] = prefixMap[styleProp];
        return eventName;
      }
      var ANIMATION_END = getVendorPrefixedEventName("animationend");
      var ANIMATION_ITERATION = getVendorPrefixedEventName("animationiteration");
      var ANIMATION_START = getVendorPrefixedEventName("animationstart");
      var TRANSITION_RUN = getVendorPrefixedEventName("transitionrun");
      var TRANSITION_START = getVendorPrefixedEventName("transitionstart");
      var TRANSITION_CANCEL = getVendorPrefixedEventName("transitioncancel");
      var TRANSITION_END = getVendorPrefixedEventName("transitionend");
      var topLevelEventsToReactNames = /* @__PURE__ */ new Map();
      var simpleEventPluginEvents = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
        " "
      );
      simpleEventPluginEvents.push("scrollEnd");
      function registerSimpleEvent(domEventName, reactName) {
        topLevelEventsToReactNames.set(domEventName, reactName);
        registerTwoPhaseEvent(reactName, [domEventName]);
      }
      var CapturedStacks = /* @__PURE__ */ new WeakMap();
      function createCapturedValueAtFiber(value, source) {
        if ("object" === typeof value && null !== value) {
          var existing = CapturedStacks.get(value);
          if (void 0 !== existing) return existing;
          source = {
            value,
            source,
            stack: getStackByFiberInDevAndProd(source)
          };
          CapturedStacks.set(value, source);
          return source;
        }
        return {
          value,
          source,
          stack: getStackByFiberInDevAndProd(source)
        };
      }
      var concurrentQueues = [];
      var concurrentQueuesIndex = 0;
      var concurrentlyUpdatedLanes = 0;
      function finishQueueingConcurrentUpdates() {
        for (var endIndex = concurrentQueuesIndex, i = concurrentlyUpdatedLanes = concurrentQueuesIndex = 0; i < endIndex; ) {
          var fiber = concurrentQueues[i];
          concurrentQueues[i++] = null;
          var queue = concurrentQueues[i];
          concurrentQueues[i++] = null;
          var update2 = concurrentQueues[i];
          concurrentQueues[i++] = null;
          var lane = concurrentQueues[i];
          concurrentQueues[i++] = null;
          if (null !== queue && null !== update2) {
            var pending = queue.pending;
            null === pending ? update2.next = update2 : (update2.next = pending.next, pending.next = update2);
            queue.pending = update2;
          }
          0 !== lane && markUpdateLaneFromFiberToRoot(fiber, update2, lane);
        }
      }
      function enqueueUpdate$1(fiber, queue, update2, lane) {
        concurrentQueues[concurrentQueuesIndex++] = fiber;
        concurrentQueues[concurrentQueuesIndex++] = queue;
        concurrentQueues[concurrentQueuesIndex++] = update2;
        concurrentQueues[concurrentQueuesIndex++] = lane;
        concurrentlyUpdatedLanes |= lane;
        fiber.lanes |= lane;
        fiber = fiber.alternate;
        null !== fiber && (fiber.lanes |= lane);
      }
      function enqueueConcurrentHookUpdate(fiber, queue, update2, lane) {
        enqueueUpdate$1(fiber, queue, update2, lane);
        return getRootForUpdatedFiber(fiber);
      }
      function enqueueConcurrentRenderForLane(fiber, lane) {
        enqueueUpdate$1(fiber, null, null, lane);
        return getRootForUpdatedFiber(fiber);
      }
      function markUpdateLaneFromFiberToRoot(sourceFiber, update2, lane) {
        sourceFiber.lanes |= lane;
        var alternate = sourceFiber.alternate;
        null !== alternate && (alternate.lanes |= lane);
        for (var isHidden = false, parent = sourceFiber.return; null !== parent; )
          parent.childLanes |= lane, alternate = parent.alternate, null !== alternate && (alternate.childLanes |= lane), 22 === parent.tag && (sourceFiber = parent.stateNode, null === sourceFiber || sourceFiber._visibility & 1 || (isHidden = true)), sourceFiber = parent, parent = parent.return;
        return 3 === sourceFiber.tag ? (parent = sourceFiber.stateNode, isHidden && null !== update2 && (isHidden = 31 - clz32(lane), sourceFiber = parent.hiddenUpdates, alternate = sourceFiber[isHidden], null === alternate ? sourceFiber[isHidden] = [update2] : alternate.push(update2), update2.lane = lane | 536870912), parent) : null;
      }
      function getRootForUpdatedFiber(sourceFiber) {
        if (50 < nestedUpdateCount)
          throw nestedUpdateCount = 0, rootWithNestedUpdates = null, Error(formatProdErrorMessage(185));
        for (var parent = sourceFiber.return; null !== parent; )
          sourceFiber = parent, parent = sourceFiber.return;
        return 3 === sourceFiber.tag ? sourceFiber.stateNode : null;
      }
      var emptyContextObject = {};
      function FiberNode(tag, pendingProps, key, mode) {
        this.tag = tag;
        this.key = key;
        this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
        this.index = 0;
        this.refCleanup = this.ref = null;
        this.pendingProps = pendingProps;
        this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
        this.mode = mode;
        this.subtreeFlags = this.flags = 0;
        this.deletions = null;
        this.childLanes = this.lanes = 0;
        this.alternate = null;
      }
      function createFiberImplClass(tag, pendingProps, key, mode) {
        return new FiberNode(tag, pendingProps, key, mode);
      }
      function shouldConstruct(Component2) {
        Component2 = Component2.prototype;
        return !(!Component2 || !Component2.isReactComponent);
      }
      function createWorkInProgress(current, pendingProps) {
        var workInProgress2 = current.alternate;
        null === workInProgress2 ? (workInProgress2 = createFiberImplClass(
          current.tag,
          pendingProps,
          current.key,
          current.mode
        ), workInProgress2.elementType = current.elementType, workInProgress2.type = current.type, workInProgress2.stateNode = current.stateNode, workInProgress2.alternate = current, current.alternate = workInProgress2) : (workInProgress2.pendingProps = pendingProps, workInProgress2.type = current.type, workInProgress2.flags = 0, workInProgress2.subtreeFlags = 0, workInProgress2.deletions = null);
        workInProgress2.flags = current.flags & 65011712;
        workInProgress2.childLanes = current.childLanes;
        workInProgress2.lanes = current.lanes;
        workInProgress2.child = current.child;
        workInProgress2.memoizedProps = current.memoizedProps;
        workInProgress2.memoizedState = current.memoizedState;
        workInProgress2.updateQueue = current.updateQueue;
        pendingProps = current.dependencies;
        workInProgress2.dependencies = null === pendingProps ? null : { lanes: pendingProps.lanes, firstContext: pendingProps.firstContext };
        workInProgress2.sibling = current.sibling;
        workInProgress2.index = current.index;
        workInProgress2.ref = current.ref;
        workInProgress2.refCleanup = current.refCleanup;
        return workInProgress2;
      }
      function resetWorkInProgress(workInProgress2, renderLanes2) {
        workInProgress2.flags &= 65011714;
        var current = workInProgress2.alternate;
        null === current ? (workInProgress2.childLanes = 0, workInProgress2.lanes = renderLanes2, workInProgress2.child = null, workInProgress2.subtreeFlags = 0, workInProgress2.memoizedProps = null, workInProgress2.memoizedState = null, workInProgress2.updateQueue = null, workInProgress2.dependencies = null, workInProgress2.stateNode = null) : (workInProgress2.childLanes = current.childLanes, workInProgress2.lanes = current.lanes, workInProgress2.child = current.child, workInProgress2.subtreeFlags = 0, workInProgress2.deletions = null, workInProgress2.memoizedProps = current.memoizedProps, workInProgress2.memoizedState = current.memoizedState, workInProgress2.updateQueue = current.updateQueue, workInProgress2.type = current.type, renderLanes2 = current.dependencies, workInProgress2.dependencies = null === renderLanes2 ? null : {
          lanes: renderLanes2.lanes,
          firstContext: renderLanes2.firstContext
        });
        return workInProgress2;
      }
      function createFiberFromTypeAndProps(type, key, pendingProps, owner, mode, lanes) {
        var fiberTag = 0;
        owner = type;
        if ("function" === typeof type) shouldConstruct(type) && (fiberTag = 1);
        else if ("string" === typeof type)
          fiberTag = isHostHoistableType(
            type,
            pendingProps,
            contextStackCursor.current
          ) ? 26 : "html" === type || "head" === type || "body" === type ? 27 : 5;
        else
          a: switch (type) {
            case REACT_ACTIVITY_TYPE:
              return type = createFiberImplClass(31, pendingProps, key, mode), type.elementType = REACT_ACTIVITY_TYPE, type.lanes = lanes, type;
            case REACT_FRAGMENT_TYPE:
              return createFiberFromFragment(pendingProps.children, mode, lanes, key);
            case REACT_STRICT_MODE_TYPE:
              fiberTag = 8;
              mode |= 24;
              break;
            case REACT_PROFILER_TYPE:
              return type = createFiberImplClass(12, pendingProps, key, mode | 2), type.elementType = REACT_PROFILER_TYPE, type.lanes = lanes, type;
            case REACT_SUSPENSE_TYPE:
              return type = createFiberImplClass(13, pendingProps, key, mode), type.elementType = REACT_SUSPENSE_TYPE, type.lanes = lanes, type;
            case REACT_SUSPENSE_LIST_TYPE:
              return type = createFiberImplClass(19, pendingProps, key, mode), type.elementType = REACT_SUSPENSE_LIST_TYPE, type.lanes = lanes, type;
            default:
              if ("object" === typeof type && null !== type)
                switch (type.$$typeof) {
                  case REACT_PROVIDER_TYPE:
                  case REACT_CONTEXT_TYPE:
                    fiberTag = 10;
                    break a;
                  case REACT_CONSUMER_TYPE:
                    fiberTag = 9;
                    break a;
                  case REACT_FORWARD_REF_TYPE:
                    fiberTag = 11;
                    break a;
                  case REACT_MEMO_TYPE:
                    fiberTag = 14;
                    break a;
                  case REACT_LAZY_TYPE:
                    fiberTag = 16;
                    owner = null;
                    break a;
                }
              fiberTag = 29;
              pendingProps = Error(
                formatProdErrorMessage(130, null === type ? "null" : typeof type, "")
              );
              owner = null;
          }
        key = createFiberImplClass(fiberTag, pendingProps, key, mode);
        key.elementType = type;
        key.type = owner;
        key.lanes = lanes;
        return key;
      }
      function createFiberFromFragment(elements, mode, lanes, key) {
        elements = createFiberImplClass(7, elements, key, mode);
        elements.lanes = lanes;
        return elements;
      }
      function createFiberFromText(content, mode, lanes) {
        content = createFiberImplClass(6, content, null, mode);
        content.lanes = lanes;
        return content;
      }
      function createFiberFromPortal(portal, mode, lanes) {
        mode = createFiberImplClass(
          4,
          null !== portal.children ? portal.children : [],
          portal.key,
          mode
        );
        mode.lanes = lanes;
        mode.stateNode = {
          containerInfo: portal.containerInfo,
          pendingChildren: null,
          implementation: portal.implementation
        };
        return mode;
      }
      var forkStack = [];
      var forkStackIndex = 0;
      var treeForkProvider = null;
      var treeForkCount = 0;
      var idStack = [];
      var idStackIndex = 0;
      var treeContextProvider = null;
      var treeContextId = 1;
      var treeContextOverflow = "";
      function pushTreeFork(workInProgress2, totalChildren) {
        forkStack[forkStackIndex++] = treeForkCount;
        forkStack[forkStackIndex++] = treeForkProvider;
        treeForkProvider = workInProgress2;
        treeForkCount = totalChildren;
      }
      function pushTreeId(workInProgress2, totalChildren, index2) {
        idStack[idStackIndex++] = treeContextId;
        idStack[idStackIndex++] = treeContextOverflow;
        idStack[idStackIndex++] = treeContextProvider;
        treeContextProvider = workInProgress2;
        var baseIdWithLeadingBit = treeContextId;
        workInProgress2 = treeContextOverflow;
        var baseLength = 32 - clz32(baseIdWithLeadingBit) - 1;
        baseIdWithLeadingBit &= ~(1 << baseLength);
        index2 += 1;
        var length = 32 - clz32(totalChildren) + baseLength;
        if (30 < length) {
          var numberOfOverflowBits = baseLength - baseLength % 5;
          length = (baseIdWithLeadingBit & (1 << numberOfOverflowBits) - 1).toString(32);
          baseIdWithLeadingBit >>= numberOfOverflowBits;
          baseLength -= numberOfOverflowBits;
          treeContextId = 1 << 32 - clz32(totalChildren) + baseLength | index2 << baseLength | baseIdWithLeadingBit;
          treeContextOverflow = length + workInProgress2;
        } else
          treeContextId = 1 << length | index2 << baseLength | baseIdWithLeadingBit, treeContextOverflow = workInProgress2;
      }
      function pushMaterializedTreeId(workInProgress2) {
        null !== workInProgress2.return && (pushTreeFork(workInProgress2, 1), pushTreeId(workInProgress2, 1, 0));
      }
      function popTreeContext(workInProgress2) {
        for (; workInProgress2 === treeForkProvider; )
          treeForkProvider = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null, treeForkCount = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null;
        for (; workInProgress2 === treeContextProvider; )
          treeContextProvider = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextOverflow = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextId = idStack[--idStackIndex], idStack[idStackIndex] = null;
      }
      var hydrationParentFiber = null;
      var nextHydratableInstance = null;
      var isHydrating = false;
      var hydrationErrors = null;
      var rootOrSingletonContext = false;
      var HydrationMismatchException = Error(formatProdErrorMessage(519));
      function throwOnHydrationMismatch(fiber) {
        var error = Error(formatProdErrorMessage(418, ""));
        queueHydrationError(createCapturedValueAtFiber(error, fiber));
        throw HydrationMismatchException;
      }
      function prepareToHydrateHostInstance(fiber) {
        var instance = fiber.stateNode, type = fiber.type, props = fiber.memoizedProps;
        instance[internalInstanceKey] = fiber;
        instance[internalPropsKey] = props;
        switch (type) {
          case "dialog":
            listenToNonDelegatedEvent("cancel", instance);
            listenToNonDelegatedEvent("close", instance);
            break;
          case "iframe":
          case "object":
          case "embed":
            listenToNonDelegatedEvent("load", instance);
            break;
          case "video":
          case "audio":
            for (type = 0; type < mediaEventTypes.length; type++)
              listenToNonDelegatedEvent(mediaEventTypes[type], instance);
            break;
          case "source":
            listenToNonDelegatedEvent("error", instance);
            break;
          case "img":
          case "image":
          case "link":
            listenToNonDelegatedEvent("error", instance);
            listenToNonDelegatedEvent("load", instance);
            break;
          case "details":
            listenToNonDelegatedEvent("toggle", instance);
            break;
          case "input":
            listenToNonDelegatedEvent("invalid", instance);
            initInput(
              instance,
              props.value,
              props.defaultValue,
              props.checked,
              props.defaultChecked,
              props.type,
              props.name,
              true
            );
            track(instance);
            break;
          case "select":
            listenToNonDelegatedEvent("invalid", instance);
            break;
          case "textarea":
            listenToNonDelegatedEvent("invalid", instance), initTextarea(instance, props.value, props.defaultValue, props.children), track(instance);
        }
        type = props.children;
        "string" !== typeof type && "number" !== typeof type && "bigint" !== typeof type || instance.textContent === "" + type || true === props.suppressHydrationWarning || checkForUnmatchedText(instance.textContent, type) ? (null != props.popover && (listenToNonDelegatedEvent("beforetoggle", instance), listenToNonDelegatedEvent("toggle", instance)), null != props.onScroll && listenToNonDelegatedEvent("scroll", instance), null != props.onScrollEnd && listenToNonDelegatedEvent("scrollend", instance), null != props.onClick && (instance.onclick = noop$1), instance = true) : instance = false;
        instance || throwOnHydrationMismatch(fiber);
      }
      function popToNextHostParent(fiber) {
        for (hydrationParentFiber = fiber.return; hydrationParentFiber; )
          switch (hydrationParentFiber.tag) {
            case 5:
            case 13:
              rootOrSingletonContext = false;
              return;
            case 27:
            case 3:
              rootOrSingletonContext = true;
              return;
            default:
              hydrationParentFiber = hydrationParentFiber.return;
          }
      }
      function popHydrationState(fiber) {
        if (fiber !== hydrationParentFiber) return false;
        if (!isHydrating) return popToNextHostParent(fiber), isHydrating = true, false;
        var tag = fiber.tag, JSCompiler_temp;
        if (JSCompiler_temp = 3 !== tag && 27 !== tag) {
          if (JSCompiler_temp = 5 === tag)
            JSCompiler_temp = fiber.type, JSCompiler_temp = !("form" !== JSCompiler_temp && "button" !== JSCompiler_temp) || shouldSetTextContent(fiber.type, fiber.memoizedProps);
          JSCompiler_temp = !JSCompiler_temp;
        }
        JSCompiler_temp && nextHydratableInstance && throwOnHydrationMismatch(fiber);
        popToNextHostParent(fiber);
        if (13 === tag) {
          fiber = fiber.memoizedState;
          fiber = null !== fiber ? fiber.dehydrated : null;
          if (!fiber) throw Error(formatProdErrorMessage(317));
          a: {
            fiber = fiber.nextSibling;
            for (tag = 0; fiber; ) {
              if (8 === fiber.nodeType)
                if (JSCompiler_temp = fiber.data, "/$" === JSCompiler_temp) {
                  if (0 === tag) {
                    nextHydratableInstance = getNextHydratable(fiber.nextSibling);
                    break a;
                  }
                  tag--;
                } else
                  "$" !== JSCompiler_temp && "$!" !== JSCompiler_temp && "$?" !== JSCompiler_temp || tag++;
              fiber = fiber.nextSibling;
            }
            nextHydratableInstance = null;
          }
        } else
          27 === tag ? (tag = nextHydratableInstance, isSingletonScope(fiber.type) ? (fiber = previousHydratableOnEnteringScopedSingleton, previousHydratableOnEnteringScopedSingleton = null, nextHydratableInstance = fiber) : nextHydratableInstance = tag) : nextHydratableInstance = hydrationParentFiber ? getNextHydratable(fiber.stateNode.nextSibling) : null;
        return true;
      }
      function resetHydrationState() {
        nextHydratableInstance = hydrationParentFiber = null;
        isHydrating = false;
      }
      function upgradeHydrationErrorsToRecoverable() {
        var queuedErrors = hydrationErrors;
        null !== queuedErrors && (null === workInProgressRootRecoverableErrors ? workInProgressRootRecoverableErrors = queuedErrors : workInProgressRootRecoverableErrors.push.apply(
          workInProgressRootRecoverableErrors,
          queuedErrors
        ), hydrationErrors = null);
        return queuedErrors;
      }
      function queueHydrationError(error) {
        null === hydrationErrors ? hydrationErrors = [error] : hydrationErrors.push(error);
      }
      var valueCursor = createCursor(null);
      var currentlyRenderingFiber$1 = null;
      var lastContextDependency = null;
      function pushProvider(providerFiber, context, nextValue) {
        push(valueCursor, context._currentValue);
        context._currentValue = nextValue;
      }
      function popProvider(context) {
        context._currentValue = valueCursor.current;
        pop(valueCursor);
      }
      function scheduleContextWorkOnParentPath(parent, renderLanes2, propagationRoot) {
        for (; null !== parent; ) {
          var alternate = parent.alternate;
          (parent.childLanes & renderLanes2) !== renderLanes2 ? (parent.childLanes |= renderLanes2, null !== alternate && (alternate.childLanes |= renderLanes2)) : null !== alternate && (alternate.childLanes & renderLanes2) !== renderLanes2 && (alternate.childLanes |= renderLanes2);
          if (parent === propagationRoot) break;
          parent = parent.return;
        }
      }
      function propagateContextChanges(workInProgress2, contexts, renderLanes2, forcePropagateEntireTree) {
        var fiber = workInProgress2.child;
        null !== fiber && (fiber.return = workInProgress2);
        for (; null !== fiber; ) {
          var list = fiber.dependencies;
          if (null !== list) {
            var nextFiber = fiber.child;
            list = list.firstContext;
            a: for (; null !== list; ) {
              var dependency = list;
              list = fiber;
              for (var i = 0; i < contexts.length; i++)
                if (dependency.context === contexts[i]) {
                  list.lanes |= renderLanes2;
                  dependency = list.alternate;
                  null !== dependency && (dependency.lanes |= renderLanes2);
                  scheduleContextWorkOnParentPath(
                    list.return,
                    renderLanes2,
                    workInProgress2
                  );
                  forcePropagateEntireTree || (nextFiber = null);
                  break a;
                }
              list = dependency.next;
            }
          } else if (18 === fiber.tag) {
            nextFiber = fiber.return;
            if (null === nextFiber) throw Error(formatProdErrorMessage(341));
            nextFiber.lanes |= renderLanes2;
            list = nextFiber.alternate;
            null !== list && (list.lanes |= renderLanes2);
            scheduleContextWorkOnParentPath(nextFiber, renderLanes2, workInProgress2);
            nextFiber = null;
          } else nextFiber = fiber.child;
          if (null !== nextFiber) nextFiber.return = fiber;
          else
            for (nextFiber = fiber; null !== nextFiber; ) {
              if (nextFiber === workInProgress2) {
                nextFiber = null;
                break;
              }
              fiber = nextFiber.sibling;
              if (null !== fiber) {
                fiber.return = nextFiber.return;
                nextFiber = fiber;
                break;
              }
              nextFiber = nextFiber.return;
            }
          fiber = nextFiber;
        }
      }
      function propagateParentContextChanges(current, workInProgress2, renderLanes2, forcePropagateEntireTree) {
        current = null;
        for (var parent = workInProgress2, isInsidePropagationBailout = false; null !== parent; ) {
          if (!isInsidePropagationBailout) {
            if (0 !== (parent.flags & 524288)) isInsidePropagationBailout = true;
            else if (0 !== (parent.flags & 262144)) break;
          }
          if (10 === parent.tag) {
            var currentParent = parent.alternate;
            if (null === currentParent) throw Error(formatProdErrorMessage(387));
            currentParent = currentParent.memoizedProps;
            if (null !== currentParent) {
              var context = parent.type;
              objectIs(parent.pendingProps.value, currentParent.value) || (null !== current ? current.push(context) : current = [context]);
            }
          } else if (parent === hostTransitionProviderCursor.current) {
            currentParent = parent.alternate;
            if (null === currentParent) throw Error(formatProdErrorMessage(387));
            currentParent.memoizedState.memoizedState !== parent.memoizedState.memoizedState && (null !== current ? current.push(HostTransitionContext) : current = [HostTransitionContext]);
          }
          parent = parent.return;
        }
        null !== current && propagateContextChanges(
          workInProgress2,
          current,
          renderLanes2,
          forcePropagateEntireTree
        );
        workInProgress2.flags |= 262144;
      }
      function checkIfContextChanged(currentDependencies) {
        for (currentDependencies = currentDependencies.firstContext; null !== currentDependencies; ) {
          if (!objectIs(
            currentDependencies.context._currentValue,
            currentDependencies.memoizedValue
          ))
            return true;
          currentDependencies = currentDependencies.next;
        }
        return false;
      }
      function prepareToReadContext(workInProgress2) {
        currentlyRenderingFiber$1 = workInProgress2;
        lastContextDependency = null;
        workInProgress2 = workInProgress2.dependencies;
        null !== workInProgress2 && (workInProgress2.firstContext = null);
      }
      function readContext(context) {
        return readContextForConsumer(currentlyRenderingFiber$1, context);
      }
      function readContextDuringReconciliation(consumer, context) {
        null === currentlyRenderingFiber$1 && prepareToReadContext(consumer);
        return readContextForConsumer(consumer, context);
      }
      function readContextForConsumer(consumer, context) {
        var value = context._currentValue;
        context = { context, memoizedValue: value, next: null };
        if (null === lastContextDependency) {
          if (null === consumer) throw Error(formatProdErrorMessage(308));
          lastContextDependency = context;
          consumer.dependencies = { lanes: 0, firstContext: context };
          consumer.flags |= 524288;
        } else lastContextDependency = lastContextDependency.next = context;
        return value;
      }
      var AbortControllerLocal = "undefined" !== typeof AbortController ? AbortController : function() {
        var listeners3 = [], signal = this.signal = {
          aborted: false,
          addEventListener: function(type, listener) {
            listeners3.push(listener);
          }
        };
        this.abort = function() {
          signal.aborted = true;
          listeners3.forEach(function(listener) {
            return listener();
          });
        };
      };
      var scheduleCallback$2 = Scheduler.unstable_scheduleCallback;
      var NormalPriority = Scheduler.unstable_NormalPriority;
      var CacheContext = {
        $$typeof: REACT_CONTEXT_TYPE,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      };
      function createCache() {
        return {
          controller: new AbortControllerLocal(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function releaseCache(cache4) {
        cache4.refCount--;
        0 === cache4.refCount && scheduleCallback$2(NormalPriority, function() {
          cache4.controller.abort();
        });
      }
      var currentEntangledListeners = null;
      var currentEntangledPendingCount = 0;
      var currentEntangledLane = 0;
      var currentEntangledActionThenable = null;
      function entangleAsyncAction(transition2, thenable) {
        if (null === currentEntangledListeners) {
          var entangledListeners = currentEntangledListeners = [];
          currentEntangledPendingCount = 0;
          currentEntangledLane = requestTransitionLane();
          currentEntangledActionThenable = {
            status: "pending",
            value: void 0,
            then: function(resolve) {
              entangledListeners.push(resolve);
            }
          };
        }
        currentEntangledPendingCount++;
        thenable.then(pingEngtangledActionScope, pingEngtangledActionScope);
        return thenable;
      }
      function pingEngtangledActionScope() {
        if (0 === --currentEntangledPendingCount && null !== currentEntangledListeners) {
          null !== currentEntangledActionThenable && (currentEntangledActionThenable.status = "fulfilled");
          var listeners3 = currentEntangledListeners;
          currentEntangledListeners = null;
          currentEntangledLane = 0;
          currentEntangledActionThenable = null;
          for (var i = 0; i < listeners3.length; i++) (0, listeners3[i])();
        }
      }
      function chainThenableValue(thenable, result) {
        var listeners3 = [], thenableWithOverride = {
          status: "pending",
          value: null,
          reason: null,
          then: function(resolve) {
            listeners3.push(resolve);
          }
        };
        thenable.then(
          function() {
            thenableWithOverride.status = "fulfilled";
            thenableWithOverride.value = result;
            for (var i = 0; i < listeners3.length; i++) (0, listeners3[i])(result);
          },
          function(error) {
            thenableWithOverride.status = "rejected";
            thenableWithOverride.reason = error;
            for (error = 0; error < listeners3.length; error++)
              (0, listeners3[error])(void 0);
          }
        );
        return thenableWithOverride;
      }
      var prevOnStartTransitionFinish = ReactSharedInternals.S;
      ReactSharedInternals.S = function(transition2, returnValue) {
        "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && entangleAsyncAction(transition2, returnValue);
        null !== prevOnStartTransitionFinish && prevOnStartTransitionFinish(transition2, returnValue);
      };
      var resumedCache = createCursor(null);
      function peekCacheFromPool() {
        var cacheResumedFromPreviousRender = resumedCache.current;
        return null !== cacheResumedFromPreviousRender ? cacheResumedFromPreviousRender : workInProgressRoot.pooledCache;
      }
      function pushTransition(offscreenWorkInProgress, prevCachePool) {
        null === prevCachePool ? push(resumedCache, resumedCache.current) : push(resumedCache, prevCachePool.pool);
      }
      function getSuspendedCache() {
        var cacheFromPool = peekCacheFromPool();
        return null === cacheFromPool ? null : { parent: CacheContext._currentValue, pool: cacheFromPool };
      }
      var SuspenseException = Error(formatProdErrorMessage(460));
      var SuspenseyCommitException = Error(formatProdErrorMessage(474));
      var SuspenseActionException = Error(formatProdErrorMessage(542));
      var noopSuspenseyCommitThenable = { then: function() {
      } };
      function isThenableResolved(thenable) {
        thenable = thenable.status;
        return "fulfilled" === thenable || "rejected" === thenable;
      }
      function noop$3() {
      }
      function trackUsedThenable(thenableState2, thenable, index2) {
        index2 = thenableState2[index2];
        void 0 === index2 ? thenableState2.push(thenable) : index2 !== thenable && (thenable.then(noop$3, noop$3), thenable = index2);
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenableState2 = thenable.reason, checkIfUseWrappedInAsyncCatch(thenableState2), thenableState2;
          default:
            if ("string" === typeof thenable.status) thenable.then(noop$3, noop$3);
            else {
              thenableState2 = workInProgressRoot;
              if (null !== thenableState2 && 100 < thenableState2.shellSuspendCounter)
                throw Error(formatProdErrorMessage(482));
              thenableState2 = thenable;
              thenableState2.status = "pending";
              thenableState2.then(
                function(fulfilledValue) {
                  if ("pending" === thenable.status) {
                    var fulfilledThenable = thenable;
                    fulfilledThenable.status = "fulfilled";
                    fulfilledThenable.value = fulfilledValue;
                  }
                },
                function(error) {
                  if ("pending" === thenable.status) {
                    var rejectedThenable = thenable;
                    rejectedThenable.status = "rejected";
                    rejectedThenable.reason = error;
                  }
                }
              );
            }
            switch (thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenableState2 = thenable.reason, checkIfUseWrappedInAsyncCatch(thenableState2), thenableState2;
            }
            suspendedThenable = thenable;
            throw SuspenseException;
        }
      }
      var suspendedThenable = null;
      function getSuspendedThenable() {
        if (null === suspendedThenable) throw Error(formatProdErrorMessage(459));
        var thenable = suspendedThenable;
        suspendedThenable = null;
        return thenable;
      }
      function checkIfUseWrappedInAsyncCatch(rejectedReason) {
        if (rejectedReason === SuspenseException || rejectedReason === SuspenseActionException)
          throw Error(formatProdErrorMessage(483));
      }
      var hasForceUpdate = false;
      function initializeUpdateQueue(fiber) {
        fiber.updateQueue = {
          baseState: fiber.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function cloneUpdateQueue(current, workInProgress2) {
        current = current.updateQueue;
        workInProgress2.updateQueue === current && (workInProgress2.updateQueue = {
          baseState: current.baseState,
          firstBaseUpdate: current.firstBaseUpdate,
          lastBaseUpdate: current.lastBaseUpdate,
          shared: current.shared,
          callbacks: null
        });
      }
      function createUpdate(lane) {
        return { lane, tag: 0, payload: null, callback: null, next: null };
      }
      function enqueueUpdate(fiber, update2, lane) {
        var updateQueue = fiber.updateQueue;
        if (null === updateQueue) return null;
        updateQueue = updateQueue.shared;
        if (0 !== (executionContext & 2)) {
          var pending = updateQueue.pending;
          null === pending ? update2.next = update2 : (update2.next = pending.next, pending.next = update2);
          updateQueue.pending = update2;
          update2 = getRootForUpdatedFiber(fiber);
          markUpdateLaneFromFiberToRoot(fiber, null, lane);
          return update2;
        }
        enqueueUpdate$1(fiber, updateQueue, update2, lane);
        return getRootForUpdatedFiber(fiber);
      }
      function entangleTransitions(root2, fiber, lane) {
        fiber = fiber.updateQueue;
        if (null !== fiber && (fiber = fiber.shared, 0 !== (lane & 4194048))) {
          var queueLanes = fiber.lanes;
          queueLanes &= root2.pendingLanes;
          lane |= queueLanes;
          fiber.lanes = lane;
          markRootEntangled(root2, lane);
        }
      }
      function enqueueCapturedUpdate(workInProgress2, capturedUpdate) {
        var queue = workInProgress2.updateQueue, current = workInProgress2.alternate;
        if (null !== current && (current = current.updateQueue, queue === current)) {
          var newFirst = null, newLast = null;
          queue = queue.firstBaseUpdate;
          if (null !== queue) {
            do {
              var clone = {
                lane: queue.lane,
                tag: queue.tag,
                payload: queue.payload,
                callback: null,
                next: null
              };
              null === newLast ? newFirst = newLast = clone : newLast = newLast.next = clone;
              queue = queue.next;
            } while (null !== queue);
            null === newLast ? newFirst = newLast = capturedUpdate : newLast = newLast.next = capturedUpdate;
          } else newFirst = newLast = capturedUpdate;
          queue = {
            baseState: current.baseState,
            firstBaseUpdate: newFirst,
            lastBaseUpdate: newLast,
            shared: current.shared,
            callbacks: current.callbacks
          };
          workInProgress2.updateQueue = queue;
          return;
        }
        workInProgress2 = queue.lastBaseUpdate;
        null === workInProgress2 ? queue.firstBaseUpdate = capturedUpdate : workInProgress2.next = capturedUpdate;
        queue.lastBaseUpdate = capturedUpdate;
      }
      var didReadFromEntangledAsyncAction = false;
      function suspendIfUpdateReadFromEntangledAsyncAction() {
        if (didReadFromEntangledAsyncAction) {
          var entangledActionThenable = currentEntangledActionThenable;
          if (null !== entangledActionThenable) throw entangledActionThenable;
        }
      }
      function processUpdateQueue(workInProgress$jscomp$0, props, instance$jscomp$0, renderLanes2) {
        didReadFromEntangledAsyncAction = false;
        var queue = workInProgress$jscomp$0.updateQueue;
        hasForceUpdate = false;
        var firstBaseUpdate = queue.firstBaseUpdate, lastBaseUpdate = queue.lastBaseUpdate, pendingQueue = queue.shared.pending;
        if (null !== pendingQueue) {
          queue.shared.pending = null;
          var lastPendingUpdate = pendingQueue, firstPendingUpdate = lastPendingUpdate.next;
          lastPendingUpdate.next = null;
          null === lastBaseUpdate ? firstBaseUpdate = firstPendingUpdate : lastBaseUpdate.next = firstPendingUpdate;
          lastBaseUpdate = lastPendingUpdate;
          var current = workInProgress$jscomp$0.alternate;
          null !== current && (current = current.updateQueue, pendingQueue = current.lastBaseUpdate, pendingQueue !== lastBaseUpdate && (null === pendingQueue ? current.firstBaseUpdate = firstPendingUpdate : pendingQueue.next = firstPendingUpdate, current.lastBaseUpdate = lastPendingUpdate));
        }
        if (null !== firstBaseUpdate) {
          var newState = queue.baseState;
          lastBaseUpdate = 0;
          current = firstPendingUpdate = lastPendingUpdate = null;
          pendingQueue = firstBaseUpdate;
          do {
            var updateLane = pendingQueue.lane & -536870913, isHiddenUpdate = updateLane !== pendingQueue.lane;
            if (isHiddenUpdate ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes2 & updateLane) === updateLane) {
              0 !== updateLane && updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction = true);
              null !== current && (current = current.next = {
                lane: 0,
                tag: pendingQueue.tag,
                payload: pendingQueue.payload,
                callback: null,
                next: null
              });
              a: {
                var workInProgress2 = workInProgress$jscomp$0, update2 = pendingQueue;
                updateLane = props;
                var instance = instance$jscomp$0;
                switch (update2.tag) {
                  case 1:
                    workInProgress2 = update2.payload;
                    if ("function" === typeof workInProgress2) {
                      newState = workInProgress2.call(instance, newState, updateLane);
                      break a;
                    }
                    newState = workInProgress2;
                    break a;
                  case 3:
                    workInProgress2.flags = workInProgress2.flags & -65537 | 128;
                  case 0:
                    workInProgress2 = update2.payload;
                    updateLane = "function" === typeof workInProgress2 ? workInProgress2.call(instance, newState, updateLane) : workInProgress2;
                    if (null === updateLane || void 0 === updateLane) break a;
                    newState = assign({}, newState, updateLane);
                    break a;
                  case 2:
                    hasForceUpdate = true;
                }
              }
              updateLane = pendingQueue.callback;
              null !== updateLane && (workInProgress$jscomp$0.flags |= 64, isHiddenUpdate && (workInProgress$jscomp$0.flags |= 8192), isHiddenUpdate = queue.callbacks, null === isHiddenUpdate ? queue.callbacks = [updateLane] : isHiddenUpdate.push(updateLane));
            } else
              isHiddenUpdate = {
                lane: updateLane,
                tag: pendingQueue.tag,
                payload: pendingQueue.payload,
                callback: pendingQueue.callback,
                next: null
              }, null === current ? (firstPendingUpdate = current = isHiddenUpdate, lastPendingUpdate = newState) : current = current.next = isHiddenUpdate, lastBaseUpdate |= updateLane;
            pendingQueue = pendingQueue.next;
            if (null === pendingQueue)
              if (pendingQueue = queue.shared.pending, null === pendingQueue)
                break;
              else
                isHiddenUpdate = pendingQueue, pendingQueue = isHiddenUpdate.next, isHiddenUpdate.next = null, queue.lastBaseUpdate = isHiddenUpdate, queue.shared.pending = null;
          } while (1);
          null === current && (lastPendingUpdate = newState);
          queue.baseState = lastPendingUpdate;
          queue.firstBaseUpdate = firstPendingUpdate;
          queue.lastBaseUpdate = current;
          null === firstBaseUpdate && (queue.shared.lanes = 0);
          workInProgressRootSkippedLanes |= lastBaseUpdate;
          workInProgress$jscomp$0.lanes = lastBaseUpdate;
          workInProgress$jscomp$0.memoizedState = newState;
        }
      }
      function callCallback(callback, context) {
        if ("function" !== typeof callback)
          throw Error(formatProdErrorMessage(191, callback));
        callback.call(context);
      }
      function commitCallbacks(updateQueue, context) {
        var callbacks = updateQueue.callbacks;
        if (null !== callbacks)
          for (updateQueue.callbacks = null, updateQueue = 0; updateQueue < callbacks.length; updateQueue++)
            callCallback(callbacks[updateQueue], context);
      }
      var currentTreeHiddenStackCursor = createCursor(null);
      var prevEntangledRenderLanesCursor = createCursor(0);
      function pushHiddenContext(fiber, context) {
        fiber = entangledRenderLanes;
        push(prevEntangledRenderLanesCursor, fiber);
        push(currentTreeHiddenStackCursor, context);
        entangledRenderLanes = fiber | context.baseLanes;
      }
      function reuseHiddenContextOnStack() {
        push(prevEntangledRenderLanesCursor, entangledRenderLanes);
        push(currentTreeHiddenStackCursor, currentTreeHiddenStackCursor.current);
      }
      function popHiddenContext() {
        entangledRenderLanes = prevEntangledRenderLanesCursor.current;
        pop(currentTreeHiddenStackCursor);
        pop(prevEntangledRenderLanesCursor);
      }
      var renderLanes = 0;
      var currentlyRenderingFiber = null;
      var currentHook = null;
      var workInProgressHook = null;
      var didScheduleRenderPhaseUpdate = false;
      var didScheduleRenderPhaseUpdateDuringThisPass = false;
      var shouldDoubleInvokeUserFnsInHooksDEV = false;
      var localIdCounter = 0;
      var thenableIndexCounter$1 = 0;
      var thenableState$1 = null;
      var globalClientIdCounter = 0;
      function throwInvalidHookError() {
        throw Error(formatProdErrorMessage(321));
      }
      function areHookInputsEqual(nextDeps, prevDeps) {
        if (null === prevDeps) return false;
        for (var i = 0; i < prevDeps.length && i < nextDeps.length; i++)
          if (!objectIs(nextDeps[i], prevDeps[i])) return false;
        return true;
      }
      function renderWithHooks(current, workInProgress2, Component2, props, secondArg, nextRenderLanes) {
        renderLanes = nextRenderLanes;
        currentlyRenderingFiber = workInProgress2;
        workInProgress2.memoizedState = null;
        workInProgress2.updateQueue = null;
        workInProgress2.lanes = 0;
        ReactSharedInternals.H = null === current || null === current.memoizedState ? HooksDispatcherOnMount : HooksDispatcherOnUpdate;
        shouldDoubleInvokeUserFnsInHooksDEV = false;
        nextRenderLanes = Component2(props, secondArg);
        shouldDoubleInvokeUserFnsInHooksDEV = false;
        didScheduleRenderPhaseUpdateDuringThisPass && (nextRenderLanes = renderWithHooksAgain(
          workInProgress2,
          Component2,
          props,
          secondArg
        ));
        finishRenderingHooks(current);
        return nextRenderLanes;
      }
      function finishRenderingHooks(current) {
        ReactSharedInternals.H = ContextOnlyDispatcher;
        var didRenderTooFewHooks = null !== currentHook && null !== currentHook.next;
        renderLanes = 0;
        workInProgressHook = currentHook = currentlyRenderingFiber = null;
        didScheduleRenderPhaseUpdate = false;
        thenableIndexCounter$1 = 0;
        thenableState$1 = null;
        if (didRenderTooFewHooks) throw Error(formatProdErrorMessage(300));
        null === current || didReceiveUpdate || (current = current.dependencies, null !== current && checkIfContextChanged(current) && (didReceiveUpdate = true));
      }
      function renderWithHooksAgain(workInProgress2, Component2, props, secondArg) {
        currentlyRenderingFiber = workInProgress2;
        var numberOfReRenders = 0;
        do {
          didScheduleRenderPhaseUpdateDuringThisPass && (thenableState$1 = null);
          thenableIndexCounter$1 = 0;
          didScheduleRenderPhaseUpdateDuringThisPass = false;
          if (25 <= numberOfReRenders) throw Error(formatProdErrorMessage(301));
          numberOfReRenders += 1;
          workInProgressHook = currentHook = null;
          if (null != workInProgress2.updateQueue) {
            var children = workInProgress2.updateQueue;
            children.lastEffect = null;
            children.events = null;
            children.stores = null;
            null != children.memoCache && (children.memoCache.index = 0);
          }
          ReactSharedInternals.H = HooksDispatcherOnRerender;
          children = Component2(props, secondArg);
        } while (didScheduleRenderPhaseUpdateDuringThisPass);
        return children;
      }
      function TransitionAwareHostComponent() {
        var dispatcher = ReactSharedInternals.H, maybeThenable = dispatcher.useState()[0];
        maybeThenable = "function" === typeof maybeThenable.then ? useThenable(maybeThenable) : maybeThenable;
        dispatcher = dispatcher.useState()[0];
        (null !== currentHook ? currentHook.memoizedState : null) !== dispatcher && (currentlyRenderingFiber.flags |= 1024);
        return maybeThenable;
      }
      function checkDidRenderIdHook() {
        var didRenderIdHook = 0 !== localIdCounter;
        localIdCounter = 0;
        return didRenderIdHook;
      }
      function bailoutHooks(current, workInProgress2, lanes) {
        workInProgress2.updateQueue = current.updateQueue;
        workInProgress2.flags &= -2053;
        current.lanes &= ~lanes;
      }
      function resetHooksOnUnwind(workInProgress2) {
        if (didScheduleRenderPhaseUpdate) {
          for (workInProgress2 = workInProgress2.memoizedState; null !== workInProgress2; ) {
            var queue = workInProgress2.queue;
            null !== queue && (queue.pending = null);
            workInProgress2 = workInProgress2.next;
          }
          didScheduleRenderPhaseUpdate = false;
        }
        renderLanes = 0;
        workInProgressHook = currentHook = currentlyRenderingFiber = null;
        didScheduleRenderPhaseUpdateDuringThisPass = false;
        thenableIndexCounter$1 = localIdCounter = 0;
        thenableState$1 = null;
      }
      function mountWorkInProgressHook() {
        var hook = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        null === workInProgressHook ? currentlyRenderingFiber.memoizedState = workInProgressHook = hook : workInProgressHook = workInProgressHook.next = hook;
        return workInProgressHook;
      }
      function updateWorkInProgressHook() {
        if (null === currentHook) {
          var nextCurrentHook = currentlyRenderingFiber.alternate;
          nextCurrentHook = null !== nextCurrentHook ? nextCurrentHook.memoizedState : null;
        } else nextCurrentHook = currentHook.next;
        var nextWorkInProgressHook = null === workInProgressHook ? currentlyRenderingFiber.memoizedState : workInProgressHook.next;
        if (null !== nextWorkInProgressHook)
          workInProgressHook = nextWorkInProgressHook, currentHook = nextCurrentHook;
        else {
          if (null === nextCurrentHook) {
            if (null === currentlyRenderingFiber.alternate)
              throw Error(formatProdErrorMessage(467));
            throw Error(formatProdErrorMessage(310));
          }
          currentHook = nextCurrentHook;
          nextCurrentHook = {
            memoizedState: currentHook.memoizedState,
            baseState: currentHook.baseState,
            baseQueue: currentHook.baseQueue,
            queue: currentHook.queue,
            next: null
          };
          null === workInProgressHook ? currentlyRenderingFiber.memoizedState = workInProgressHook = nextCurrentHook : workInProgressHook = workInProgressHook.next = nextCurrentHook;
        }
        return workInProgressHook;
      }
      function createFunctionComponentUpdateQueue() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function useThenable(thenable) {
        var index2 = thenableIndexCounter$1;
        thenableIndexCounter$1 += 1;
        null === thenableState$1 && (thenableState$1 = []);
        thenable = trackUsedThenable(thenableState$1, thenable, index2);
        index2 = currentlyRenderingFiber;
        null === (null === workInProgressHook ? index2.memoizedState : workInProgressHook.next) && (index2 = index2.alternate, ReactSharedInternals.H = null === index2 || null === index2.memoizedState ? HooksDispatcherOnMount : HooksDispatcherOnUpdate);
        return thenable;
      }
      function use(usable) {
        if (null !== usable && "object" === typeof usable) {
          if ("function" === typeof usable.then) return useThenable(usable);
          if (usable.$$typeof === REACT_CONTEXT_TYPE) return readContext(usable);
        }
        throw Error(formatProdErrorMessage(438, String(usable)));
      }
      function useMemoCache(size) {
        var memoCache = null, updateQueue = currentlyRenderingFiber.updateQueue;
        null !== updateQueue && (memoCache = updateQueue.memoCache);
        if (null == memoCache) {
          var current = currentlyRenderingFiber.alternate;
          null !== current && (current = current.updateQueue, null !== current && (current = current.memoCache, null != current && (memoCache = {
            data: current.data.map(function(array) {
              return array.slice();
            }),
            index: 0
          })));
        }
        null == memoCache && (memoCache = { data: [], index: 0 });
        null === updateQueue && (updateQueue = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = updateQueue);
        updateQueue.memoCache = memoCache;
        updateQueue = memoCache.data[memoCache.index];
        if (void 0 === updateQueue)
          for (updateQueue = memoCache.data[memoCache.index] = Array(size), current = 0; current < size; current++)
            updateQueue[current] = REACT_MEMO_CACHE_SENTINEL;
        memoCache.index++;
        return updateQueue;
      }
      function basicStateReducer(state, action) {
        return "function" === typeof action ? action(state) : action;
      }
      function updateReducer(reducer) {
        var hook = updateWorkInProgressHook();
        return updateReducerImpl(hook, currentHook, reducer);
      }
      function updateReducerImpl(hook, current, reducer) {
        var queue = hook.queue;
        if (null === queue) throw Error(formatProdErrorMessage(311));
        queue.lastRenderedReducer = reducer;
        var baseQueue = hook.baseQueue, pendingQueue = queue.pending;
        if (null !== pendingQueue) {
          if (null !== baseQueue) {
            var baseFirst = baseQueue.next;
            baseQueue.next = pendingQueue.next;
            pendingQueue.next = baseFirst;
          }
          current.baseQueue = baseQueue = pendingQueue;
          queue.pending = null;
        }
        pendingQueue = hook.baseState;
        if (null === baseQueue) hook.memoizedState = pendingQueue;
        else {
          current = baseQueue.next;
          var newBaseQueueFirst = baseFirst = null, newBaseQueueLast = null, update2 = current, didReadFromEntangledAsyncAction$32 = false;
          do {
            var updateLane = update2.lane & -536870913;
            if (updateLane !== update2.lane ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes & updateLane) === updateLane) {
              var revertLane = update2.revertLane;
              if (0 === revertLane)
                null !== newBaseQueueLast && (newBaseQueueLast = newBaseQueueLast.next = {
                  lane: 0,
                  revertLane: 0,
                  action: update2.action,
                  hasEagerState: update2.hasEagerState,
                  eagerState: update2.eagerState,
                  next: null
                }), updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction$32 = true);
              else if ((renderLanes & revertLane) === revertLane) {
                update2 = update2.next;
                revertLane === currentEntangledLane && (didReadFromEntangledAsyncAction$32 = true);
                continue;
              } else
                updateLane = {
                  lane: 0,
                  revertLane: update2.revertLane,
                  action: update2.action,
                  hasEagerState: update2.hasEagerState,
                  eagerState: update2.eagerState,
                  next: null
                }, null === newBaseQueueLast ? (newBaseQueueFirst = newBaseQueueLast = updateLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = updateLane, currentlyRenderingFiber.lanes |= revertLane, workInProgressRootSkippedLanes |= revertLane;
              updateLane = update2.action;
              shouldDoubleInvokeUserFnsInHooksDEV && reducer(pendingQueue, updateLane);
              pendingQueue = update2.hasEagerState ? update2.eagerState : reducer(pendingQueue, updateLane);
            } else
              revertLane = {
                lane: updateLane,
                revertLane: update2.revertLane,
                action: update2.action,
                hasEagerState: update2.hasEagerState,
                eagerState: update2.eagerState,
                next: null
              }, null === newBaseQueueLast ? (newBaseQueueFirst = newBaseQueueLast = revertLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = revertLane, currentlyRenderingFiber.lanes |= updateLane, workInProgressRootSkippedLanes |= updateLane;
            update2 = update2.next;
          } while (null !== update2 && update2 !== current);
          null === newBaseQueueLast ? baseFirst = pendingQueue : newBaseQueueLast.next = newBaseQueueFirst;
          if (!objectIs(pendingQueue, hook.memoizedState) && (didReceiveUpdate = true, didReadFromEntangledAsyncAction$32 && (reducer = currentEntangledActionThenable, null !== reducer)))
            throw reducer;
          hook.memoizedState = pendingQueue;
          hook.baseState = baseFirst;
          hook.baseQueue = newBaseQueueLast;
          queue.lastRenderedState = pendingQueue;
        }
        null === baseQueue && (queue.lanes = 0);
        return [hook.memoizedState, queue.dispatch];
      }
      function rerenderReducer(reducer) {
        var hook = updateWorkInProgressHook(), queue = hook.queue;
        if (null === queue) throw Error(formatProdErrorMessage(311));
        queue.lastRenderedReducer = reducer;
        var dispatch = queue.dispatch, lastRenderPhaseUpdate = queue.pending, newState = hook.memoizedState;
        if (null !== lastRenderPhaseUpdate) {
          queue.pending = null;
          var update2 = lastRenderPhaseUpdate = lastRenderPhaseUpdate.next;
          do
            newState = reducer(newState, update2.action), update2 = update2.next;
          while (update2 !== lastRenderPhaseUpdate);
          objectIs(newState, hook.memoizedState) || (didReceiveUpdate = true);
          hook.memoizedState = newState;
          null === hook.baseQueue && (hook.baseState = newState);
          queue.lastRenderedState = newState;
        }
        return [newState, dispatch];
      }
      function updateSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
        var fiber = currentlyRenderingFiber, hook = updateWorkInProgressHook(), isHydrating$jscomp$0 = isHydrating;
        if (isHydrating$jscomp$0) {
          if (void 0 === getServerSnapshot) throw Error(formatProdErrorMessage(407));
          getServerSnapshot = getServerSnapshot();
        } else getServerSnapshot = getSnapshot();
        var snapshotChanged = !objectIs(
          (currentHook || hook).memoizedState,
          getServerSnapshot
        );
        snapshotChanged && (hook.memoizedState = getServerSnapshot, didReceiveUpdate = true);
        hook = hook.queue;
        var create2 = subscribeToStore.bind(null, fiber, hook, subscribe);
        updateEffectImpl(2048, 8, create2, [subscribe]);
        if (hook.getSnapshot !== getSnapshot || snapshotChanged || null !== workInProgressHook && workInProgressHook.memoizedState.tag & 1) {
          fiber.flags |= 2048;
          pushSimpleEffect(
            9,
            createEffectInstance(),
            updateStoreInstance.bind(
              null,
              fiber,
              hook,
              getServerSnapshot,
              getSnapshot
            ),
            null
          );
          if (null === workInProgressRoot) throw Error(formatProdErrorMessage(349));
          isHydrating$jscomp$0 || 0 !== (renderLanes & 124) || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
        }
        return getServerSnapshot;
      }
      function pushStoreConsistencyCheck(fiber, getSnapshot, renderedSnapshot) {
        fiber.flags |= 16384;
        fiber = { getSnapshot, value: renderedSnapshot };
        getSnapshot = currentlyRenderingFiber.updateQueue;
        null === getSnapshot ? (getSnapshot = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = getSnapshot, getSnapshot.stores = [fiber]) : (renderedSnapshot = getSnapshot.stores, null === renderedSnapshot ? getSnapshot.stores = [fiber] : renderedSnapshot.push(fiber));
      }
      function updateStoreInstance(fiber, inst, nextSnapshot, getSnapshot) {
        inst.value = nextSnapshot;
        inst.getSnapshot = getSnapshot;
        checkIfSnapshotChanged(inst) && forceStoreRerender(fiber);
      }
      function subscribeToStore(fiber, inst, subscribe) {
        return subscribe(function() {
          checkIfSnapshotChanged(inst) && forceStoreRerender(fiber);
        });
      }
      function checkIfSnapshotChanged(inst) {
        var latestGetSnapshot = inst.getSnapshot;
        inst = inst.value;
        try {
          var nextValue = latestGetSnapshot();
          return !objectIs(inst, nextValue);
        } catch (error) {
          return true;
        }
      }
      function forceStoreRerender(fiber) {
        var root2 = enqueueConcurrentRenderForLane(fiber, 2);
        null !== root2 && scheduleUpdateOnFiber(root2, fiber, 2);
      }
      function mountStateImpl(initialState) {
        var hook = mountWorkInProgressHook();
        if ("function" === typeof initialState) {
          var initialStateInitializer = initialState;
          initialState = initialStateInitializer();
          if (shouldDoubleInvokeUserFnsInHooksDEV) {
            setIsStrictModeForDevtools(true);
            try {
              initialStateInitializer();
            } finally {
              setIsStrictModeForDevtools(false);
            }
          }
        }
        hook.memoizedState = hook.baseState = initialState;
        hook.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: basicStateReducer,
          lastRenderedState: initialState
        };
        return hook;
      }
      function updateOptimisticImpl(hook, current, passthrough, reducer) {
        hook.baseState = passthrough;
        return updateReducerImpl(
          hook,
          currentHook,
          "function" === typeof reducer ? reducer : basicStateReducer
        );
      }
      function dispatchActionState(fiber, actionQueue, setPendingState, setState, payload) {
        if (isRenderPhaseUpdate(fiber)) throw Error(formatProdErrorMessage(485));
        fiber = actionQueue.action;
        if (null !== fiber) {
          var actionNode = {
            payload,
            action: fiber,
            next: null,
            isTransition: true,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(listener) {
              actionNode.listeners.push(listener);
            }
          };
          null !== ReactSharedInternals.T ? setPendingState(true) : actionNode.isTransition = false;
          setState(actionNode);
          setPendingState = actionQueue.pending;
          null === setPendingState ? (actionNode.next = actionQueue.pending = actionNode, runActionStateAction(actionQueue, actionNode)) : (actionNode.next = setPendingState.next, actionQueue.pending = setPendingState.next = actionNode);
        }
      }
      function runActionStateAction(actionQueue, node) {
        var action = node.action, payload = node.payload, prevState = actionQueue.state;
        if (node.isTransition) {
          var prevTransition = ReactSharedInternals.T, currentTransition = {};
          ReactSharedInternals.T = currentTransition;
          try {
            var returnValue = action(prevState, payload), onStartTransitionFinish = ReactSharedInternals.S;
            null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
            handleActionReturnValue(actionQueue, node, returnValue);
          } catch (error) {
            onActionError(actionQueue, node, error);
          } finally {
            ReactSharedInternals.T = prevTransition;
          }
        } else
          try {
            prevTransition = action(prevState, payload), handleActionReturnValue(actionQueue, node, prevTransition);
          } catch (error$38) {
            onActionError(actionQueue, node, error$38);
          }
      }
      function handleActionReturnValue(actionQueue, node, returnValue) {
        null !== returnValue && "object" === typeof returnValue && "function" === typeof returnValue.then ? returnValue.then(
          function(nextState) {
            onActionSuccess(actionQueue, node, nextState);
          },
          function(error) {
            return onActionError(actionQueue, node, error);
          }
        ) : onActionSuccess(actionQueue, node, returnValue);
      }
      function onActionSuccess(actionQueue, actionNode, nextState) {
        actionNode.status = "fulfilled";
        actionNode.value = nextState;
        notifyActionListeners(actionNode);
        actionQueue.state = nextState;
        actionNode = actionQueue.pending;
        null !== actionNode && (nextState = actionNode.next, nextState === actionNode ? actionQueue.pending = null : (nextState = nextState.next, actionNode.next = nextState, runActionStateAction(actionQueue, nextState)));
      }
      function onActionError(actionQueue, actionNode, error) {
        var last = actionQueue.pending;
        actionQueue.pending = null;
        if (null !== last) {
          last = last.next;
          do
            actionNode.status = "rejected", actionNode.reason = error, notifyActionListeners(actionNode), actionNode = actionNode.next;
          while (actionNode !== last);
        }
        actionQueue.action = null;
      }
      function notifyActionListeners(actionNode) {
        actionNode = actionNode.listeners;
        for (var i = 0; i < actionNode.length; i++) (0, actionNode[i])();
      }
      function actionStateReducer(oldState, newState) {
        return newState;
      }
      function mountActionState(action, initialStateProp) {
        if (isHydrating) {
          var ssrFormState = workInProgressRoot.formState;
          if (null !== ssrFormState) {
            a: {
              var JSCompiler_inline_result = currentlyRenderingFiber;
              if (isHydrating) {
                if (nextHydratableInstance) {
                  b: {
                    var JSCompiler_inline_result$jscomp$0 = nextHydratableInstance;
                    for (var inRootOrSingleton = rootOrSingletonContext; 8 !== JSCompiler_inline_result$jscomp$0.nodeType; ) {
                      if (!inRootOrSingleton) {
                        JSCompiler_inline_result$jscomp$0 = null;
                        break b;
                      }
                      JSCompiler_inline_result$jscomp$0 = getNextHydratable(
                        JSCompiler_inline_result$jscomp$0.nextSibling
                      );
                      if (null === JSCompiler_inline_result$jscomp$0) {
                        JSCompiler_inline_result$jscomp$0 = null;
                        break b;
                      }
                    }
                    inRootOrSingleton = JSCompiler_inline_result$jscomp$0.data;
                    JSCompiler_inline_result$jscomp$0 = "F!" === inRootOrSingleton || "F" === inRootOrSingleton ? JSCompiler_inline_result$jscomp$0 : null;
                  }
                  if (JSCompiler_inline_result$jscomp$0) {
                    nextHydratableInstance = getNextHydratable(
                      JSCompiler_inline_result$jscomp$0.nextSibling
                    );
                    JSCompiler_inline_result = "F!" === JSCompiler_inline_result$jscomp$0.data;
                    break a;
                  }
                }
                throwOnHydrationMismatch(JSCompiler_inline_result);
              }
              JSCompiler_inline_result = false;
            }
            JSCompiler_inline_result && (initialStateProp = ssrFormState[0]);
          }
        }
        ssrFormState = mountWorkInProgressHook();
        ssrFormState.memoizedState = ssrFormState.baseState = initialStateProp;
        JSCompiler_inline_result = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: actionStateReducer,
          lastRenderedState: initialStateProp
        };
        ssrFormState.queue = JSCompiler_inline_result;
        ssrFormState = dispatchSetState.bind(
          null,
          currentlyRenderingFiber,
          JSCompiler_inline_result
        );
        JSCompiler_inline_result.dispatch = ssrFormState;
        JSCompiler_inline_result = mountStateImpl(false);
        inRootOrSingleton = dispatchOptimisticSetState.bind(
          null,
          currentlyRenderingFiber,
          false,
          JSCompiler_inline_result.queue
        );
        JSCompiler_inline_result = mountWorkInProgressHook();
        JSCompiler_inline_result$jscomp$0 = {
          state: initialStateProp,
          dispatch: null,
          action,
          pending: null
        };
        JSCompiler_inline_result.queue = JSCompiler_inline_result$jscomp$0;
        ssrFormState = dispatchActionState.bind(
          null,
          currentlyRenderingFiber,
          JSCompiler_inline_result$jscomp$0,
          inRootOrSingleton,
          ssrFormState
        );
        JSCompiler_inline_result$jscomp$0.dispatch = ssrFormState;
        JSCompiler_inline_result.memoizedState = action;
        return [initialStateProp, ssrFormState, false];
      }
      function updateActionState(action) {
        var stateHook = updateWorkInProgressHook();
        return updateActionStateImpl(stateHook, currentHook, action);
      }
      function updateActionStateImpl(stateHook, currentStateHook, action) {
        currentStateHook = updateReducerImpl(
          stateHook,
          currentStateHook,
          actionStateReducer
        )[0];
        stateHook = updateReducer(basicStateReducer)[0];
        if ("object" === typeof currentStateHook && null !== currentStateHook && "function" === typeof currentStateHook.then)
          try {
            var state = useThenable(currentStateHook);
          } catch (x) {
            if (x === SuspenseException) throw SuspenseActionException;
            throw x;
          }
        else state = currentStateHook;
        currentStateHook = updateWorkInProgressHook();
        var actionQueue = currentStateHook.queue, dispatch = actionQueue.dispatch;
        action !== currentStateHook.memoizedState && (currentlyRenderingFiber.flags |= 2048, pushSimpleEffect(
          9,
          createEffectInstance(),
          actionStateActionEffect.bind(null, actionQueue, action),
          null
        ));
        return [state, dispatch, stateHook];
      }
      function actionStateActionEffect(actionQueue, action) {
        actionQueue.action = action;
      }
      function rerenderActionState(action) {
        var stateHook = updateWorkInProgressHook(), currentStateHook = currentHook;
        if (null !== currentStateHook)
          return updateActionStateImpl(stateHook, currentStateHook, action);
        updateWorkInProgressHook();
        stateHook = stateHook.memoizedState;
        currentStateHook = updateWorkInProgressHook();
        var dispatch = currentStateHook.queue.dispatch;
        currentStateHook.memoizedState = action;
        return [stateHook, dispatch, false];
      }
      function pushSimpleEffect(tag, inst, create2, createDeps) {
        tag = { tag, create: create2, deps: createDeps, inst, next: null };
        inst = currentlyRenderingFiber.updateQueue;
        null === inst && (inst = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = inst);
        create2 = inst.lastEffect;
        null === create2 ? inst.lastEffect = tag.next = tag : (createDeps = create2.next, create2.next = tag, tag.next = createDeps, inst.lastEffect = tag);
        return tag;
      }
      function createEffectInstance() {
        return { destroy: void 0, resource: void 0 };
      }
      function updateRef() {
        return updateWorkInProgressHook().memoizedState;
      }
      function mountEffectImpl(fiberFlags, hookFlags, create2, createDeps) {
        var hook = mountWorkInProgressHook();
        createDeps = void 0 === createDeps ? null : createDeps;
        currentlyRenderingFiber.flags |= fiberFlags;
        hook.memoizedState = pushSimpleEffect(
          1 | hookFlags,
          createEffectInstance(),
          create2,
          createDeps
        );
      }
      function updateEffectImpl(fiberFlags, hookFlags, create2, deps) {
        var hook = updateWorkInProgressHook();
        deps = void 0 === deps ? null : deps;
        var inst = hook.memoizedState.inst;
        null !== currentHook && null !== deps && areHookInputsEqual(deps, currentHook.memoizedState.deps) ? hook.memoizedState = pushSimpleEffect(hookFlags, inst, create2, deps) : (currentlyRenderingFiber.flags |= fiberFlags, hook.memoizedState = pushSimpleEffect(
          1 | hookFlags,
          inst,
          create2,
          deps
        ));
      }
      function mountEffect(create2, createDeps) {
        mountEffectImpl(8390656, 8, create2, createDeps);
      }
      function updateEffect(create2, createDeps) {
        updateEffectImpl(2048, 8, create2, createDeps);
      }
      function updateInsertionEffect(create2, deps) {
        return updateEffectImpl(4, 2, create2, deps);
      }
      function updateLayoutEffect(create2, deps) {
        return updateEffectImpl(4, 4, create2, deps);
      }
      function imperativeHandleEffect(create2, ref) {
        if ("function" === typeof ref) {
          create2 = create2();
          var refCleanup = ref(create2);
          return function() {
            "function" === typeof refCleanup ? refCleanup() : ref(null);
          };
        }
        if (null !== ref && void 0 !== ref)
          return create2 = create2(), ref.current = create2, function() {
            ref.current = null;
          };
      }
      function updateImperativeHandle(ref, create2, deps) {
        deps = null !== deps && void 0 !== deps ? deps.concat([ref]) : null;
        updateEffectImpl(4, 4, imperativeHandleEffect.bind(null, create2, ref), deps);
      }
      function mountDebugValue() {
      }
      function updateCallback(callback, deps) {
        var hook = updateWorkInProgressHook();
        deps = void 0 === deps ? null : deps;
        var prevState = hook.memoizedState;
        if (null !== deps && areHookInputsEqual(deps, prevState[1]))
          return prevState[0];
        hook.memoizedState = [callback, deps];
        return callback;
      }
      function updateMemo(nextCreate, deps) {
        var hook = updateWorkInProgressHook();
        deps = void 0 === deps ? null : deps;
        var prevState = hook.memoizedState;
        if (null !== deps && areHookInputsEqual(deps, prevState[1]))
          return prevState[0];
        prevState = nextCreate();
        if (shouldDoubleInvokeUserFnsInHooksDEV) {
          setIsStrictModeForDevtools(true);
          try {
            nextCreate();
          } finally {
            setIsStrictModeForDevtools(false);
          }
        }
        hook.memoizedState = [prevState, deps];
        return prevState;
      }
      function mountDeferredValueImpl(hook, value, initialValue) {
        if (void 0 === initialValue || 0 !== (renderLanes & 1073741824))
          return hook.memoizedState = value;
        hook.memoizedState = initialValue;
        hook = requestDeferredLane();
        currentlyRenderingFiber.lanes |= hook;
        workInProgressRootSkippedLanes |= hook;
        return initialValue;
      }
      function updateDeferredValueImpl(hook, prevValue, value, initialValue) {
        if (objectIs(value, prevValue)) return value;
        if (null !== currentTreeHiddenStackCursor.current)
          return hook = mountDeferredValueImpl(hook, value, initialValue), objectIs(hook, prevValue) || (didReceiveUpdate = true), hook;
        if (0 === (renderLanes & 42))
          return didReceiveUpdate = true, hook.memoizedState = value;
        hook = requestDeferredLane();
        currentlyRenderingFiber.lanes |= hook;
        workInProgressRootSkippedLanes |= hook;
        return prevValue;
      }
      function startTransition(fiber, queue, pendingState, finishedState, callback) {
        var previousPriority = ReactDOMSharedInternals.p;
        ReactDOMSharedInternals.p = 0 !== previousPriority && 8 > previousPriority ? previousPriority : 8;
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        ReactSharedInternals.T = currentTransition;
        dispatchOptimisticSetState(fiber, false, queue, pendingState);
        try {
          var returnValue = callback(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          if (null !== returnValue && "object" === typeof returnValue && "function" === typeof returnValue.then) {
            var thenableForFinishedState = chainThenableValue(
              returnValue,
              finishedState
            );
            dispatchSetStateInternal(
              fiber,
              queue,
              thenableForFinishedState,
              requestUpdateLane(fiber)
            );
          } else
            dispatchSetStateInternal(
              fiber,
              queue,
              finishedState,
              requestUpdateLane(fiber)
            );
        } catch (error) {
          dispatchSetStateInternal(
            fiber,
            queue,
            { then: function() {
            }, status: "rejected", reason: error },
            requestUpdateLane()
          );
        } finally {
          ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
        }
      }
      function noop$2() {
      }
      function startHostTransition(formFiber, pendingState, action, formData) {
        if (5 !== formFiber.tag) throw Error(formatProdErrorMessage(476));
        var queue = ensureFormComponentIsStateful(formFiber).queue;
        startTransition(
          formFiber,
          queue,
          pendingState,
          sharedNotPendingObject,
          null === action ? noop$2 : function() {
            requestFormReset$1(formFiber);
            return action(formData);
          }
        );
      }
      function ensureFormComponentIsStateful(formFiber) {
        var existingStateHook = formFiber.memoizedState;
        if (null !== existingStateHook) return existingStateHook;
        existingStateHook = {
          memoizedState: sharedNotPendingObject,
          baseState: sharedNotPendingObject,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: basicStateReducer,
            lastRenderedState: sharedNotPendingObject
          },
          next: null
        };
        var initialResetState = {};
        existingStateHook.next = {
          memoizedState: initialResetState,
          baseState: initialResetState,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: basicStateReducer,
            lastRenderedState: initialResetState
          },
          next: null
        };
        formFiber.memoizedState = existingStateHook;
        formFiber = formFiber.alternate;
        null !== formFiber && (formFiber.memoizedState = existingStateHook);
        return existingStateHook;
      }
      function requestFormReset$1(formFiber) {
        var resetStateQueue = ensureFormComponentIsStateful(formFiber).next.queue;
        dispatchSetStateInternal(formFiber, resetStateQueue, {}, requestUpdateLane());
      }
      function useHostTransitionStatus() {
        return readContext(HostTransitionContext);
      }
      function updateId() {
        return updateWorkInProgressHook().memoizedState;
      }
      function updateRefresh() {
        return updateWorkInProgressHook().memoizedState;
      }
      function refreshCache(fiber) {
        for (var provider = fiber.return; null !== provider; ) {
          switch (provider.tag) {
            case 24:
            case 3:
              var lane = requestUpdateLane();
              fiber = createUpdate(lane);
              var root$41 = enqueueUpdate(provider, fiber, lane);
              null !== root$41 && (scheduleUpdateOnFiber(root$41, provider, lane), entangleTransitions(root$41, provider, lane));
              provider = { cache: createCache() };
              fiber.payload = provider;
              return;
          }
          provider = provider.return;
        }
      }
      function dispatchReducerAction(fiber, queue, action) {
        var lane = requestUpdateLane();
        action = {
          lane,
          revertLane: 0,
          action,
          hasEagerState: false,
          eagerState: null,
          next: null
        };
        isRenderPhaseUpdate(fiber) ? enqueueRenderPhaseUpdate(queue, action) : (action = enqueueConcurrentHookUpdate(fiber, queue, action, lane), null !== action && (scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane)));
      }
      function dispatchSetState(fiber, queue, action) {
        var lane = requestUpdateLane();
        dispatchSetStateInternal(fiber, queue, action, lane);
      }
      function dispatchSetStateInternal(fiber, queue, action, lane) {
        var update2 = {
          lane,
          revertLane: 0,
          action,
          hasEagerState: false,
          eagerState: null,
          next: null
        };
        if (isRenderPhaseUpdate(fiber)) enqueueRenderPhaseUpdate(queue, update2);
        else {
          var alternate = fiber.alternate;
          if (0 === fiber.lanes && (null === alternate || 0 === alternate.lanes) && (alternate = queue.lastRenderedReducer, null !== alternate))
            try {
              var currentState = queue.lastRenderedState, eagerState = alternate(currentState, action);
              update2.hasEagerState = true;
              update2.eagerState = eagerState;
              if (objectIs(eagerState, currentState))
                return enqueueUpdate$1(fiber, queue, update2, 0), null === workInProgressRoot && finishQueueingConcurrentUpdates(), false;
            } catch (error) {
            } finally {
            }
          action = enqueueConcurrentHookUpdate(fiber, queue, update2, lane);
          if (null !== action)
            return scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane), true;
        }
        return false;
      }
      function dispatchOptimisticSetState(fiber, throwIfDuringRender, queue, action) {
        action = {
          lane: 2,
          revertLane: requestTransitionLane(),
          action,
          hasEagerState: false,
          eagerState: null,
          next: null
        };
        if (isRenderPhaseUpdate(fiber)) {
          if (throwIfDuringRender) throw Error(formatProdErrorMessage(479));
        } else
          throwIfDuringRender = enqueueConcurrentHookUpdate(
            fiber,
            queue,
            action,
            2
          ), null !== throwIfDuringRender && scheduleUpdateOnFiber(throwIfDuringRender, fiber, 2);
      }
      function isRenderPhaseUpdate(fiber) {
        var alternate = fiber.alternate;
        return fiber === currentlyRenderingFiber || null !== alternate && alternate === currentlyRenderingFiber;
      }
      function enqueueRenderPhaseUpdate(queue, update2) {
        didScheduleRenderPhaseUpdateDuringThisPass = didScheduleRenderPhaseUpdate = true;
        var pending = queue.pending;
        null === pending ? update2.next = update2 : (update2.next = pending.next, pending.next = update2);
        queue.pending = update2;
      }
      function entangleTransitionUpdate(root2, queue, lane) {
        if (0 !== (lane & 4194048)) {
          var queueLanes = queue.lanes;
          queueLanes &= root2.pendingLanes;
          lane |= queueLanes;
          queue.lanes = lane;
          markRootEntangled(root2, lane);
        }
      }
      var ContextOnlyDispatcher = {
        readContext,
        use,
        useCallback: throwInvalidHookError,
        useContext: throwInvalidHookError,
        useEffect: throwInvalidHookError,
        useImperativeHandle: throwInvalidHookError,
        useLayoutEffect: throwInvalidHookError,
        useInsertionEffect: throwInvalidHookError,
        useMemo: throwInvalidHookError,
        useReducer: throwInvalidHookError,
        useRef: throwInvalidHookError,
        useState: throwInvalidHookError,
        useDebugValue: throwInvalidHookError,
        useDeferredValue: throwInvalidHookError,
        useTransition: throwInvalidHookError,
        useSyncExternalStore: throwInvalidHookError,
        useId: throwInvalidHookError,
        useHostTransitionStatus: throwInvalidHookError,
        useFormState: throwInvalidHookError,
        useActionState: throwInvalidHookError,
        useOptimistic: throwInvalidHookError,
        useMemoCache: throwInvalidHookError,
        useCacheRefresh: throwInvalidHookError
      };
      var HooksDispatcherOnMount = {
        readContext,
        use,
        useCallback: function(callback, deps) {
          mountWorkInProgressHook().memoizedState = [
            callback,
            void 0 === deps ? null : deps
          ];
          return callback;
        },
        useContext: readContext,
        useEffect: mountEffect,
        useImperativeHandle: function(ref, create2, deps) {
          deps = null !== deps && void 0 !== deps ? deps.concat([ref]) : null;
          mountEffectImpl(
            4194308,
            4,
            imperativeHandleEffect.bind(null, create2, ref),
            deps
          );
        },
        useLayoutEffect: function(create2, deps) {
          return mountEffectImpl(4194308, 4, create2, deps);
        },
        useInsertionEffect: function(create2, deps) {
          mountEffectImpl(4, 2, create2, deps);
        },
        useMemo: function(nextCreate, deps) {
          var hook = mountWorkInProgressHook();
          deps = void 0 === deps ? null : deps;
          var nextValue = nextCreate();
          if (shouldDoubleInvokeUserFnsInHooksDEV) {
            setIsStrictModeForDevtools(true);
            try {
              nextCreate();
            } finally {
              setIsStrictModeForDevtools(false);
            }
          }
          hook.memoizedState = [nextValue, deps];
          return nextValue;
        },
        useReducer: function(reducer, initialArg, init) {
          var hook = mountWorkInProgressHook();
          if (void 0 !== init) {
            var initialState = init(initialArg);
            if (shouldDoubleInvokeUserFnsInHooksDEV) {
              setIsStrictModeForDevtools(true);
              try {
                init(initialArg);
              } finally {
                setIsStrictModeForDevtools(false);
              }
            }
          } else initialState = initialArg;
          hook.memoizedState = hook.baseState = initialState;
          reducer = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: reducer,
            lastRenderedState: initialState
          };
          hook.queue = reducer;
          reducer = reducer.dispatch = dispatchReducerAction.bind(
            null,
            currentlyRenderingFiber,
            reducer
          );
          return [hook.memoizedState, reducer];
        },
        useRef: function(initialValue) {
          var hook = mountWorkInProgressHook();
          initialValue = { current: initialValue };
          return hook.memoizedState = initialValue;
        },
        useState: function(initialState) {
          initialState = mountStateImpl(initialState);
          var queue = initialState.queue, dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
          queue.dispatch = dispatch;
          return [initialState.memoizedState, dispatch];
        },
        useDebugValue: mountDebugValue,
        useDeferredValue: function(value, initialValue) {
          var hook = mountWorkInProgressHook();
          return mountDeferredValueImpl(hook, value, initialValue);
        },
        useTransition: function() {
          var stateHook = mountStateImpl(false);
          stateHook = startTransition.bind(
            null,
            currentlyRenderingFiber,
            stateHook.queue,
            true,
            false
          );
          mountWorkInProgressHook().memoizedState = stateHook;
          return [false, stateHook];
        },
        useSyncExternalStore: function(subscribe, getSnapshot, getServerSnapshot) {
          var fiber = currentlyRenderingFiber, hook = mountWorkInProgressHook();
          if (isHydrating) {
            if (void 0 === getServerSnapshot)
              throw Error(formatProdErrorMessage(407));
            getServerSnapshot = getServerSnapshot();
          } else {
            getServerSnapshot = getSnapshot();
            if (null === workInProgressRoot)
              throw Error(formatProdErrorMessage(349));
            0 !== (workInProgressRootRenderLanes & 124) || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
          }
          hook.memoizedState = getServerSnapshot;
          var inst = { value: getServerSnapshot, getSnapshot };
          hook.queue = inst;
          mountEffect(subscribeToStore.bind(null, fiber, inst, subscribe), [
            subscribe
          ]);
          fiber.flags |= 2048;
          pushSimpleEffect(
            9,
            createEffectInstance(),
            updateStoreInstance.bind(
              null,
              fiber,
              inst,
              getServerSnapshot,
              getSnapshot
            ),
            null
          );
          return getServerSnapshot;
        },
        useId: function() {
          var hook = mountWorkInProgressHook(), identifierPrefix = workInProgressRoot.identifierPrefix;
          if (isHydrating) {
            var JSCompiler_inline_result = treeContextOverflow;
            var idWithLeadingBit = treeContextId;
            JSCompiler_inline_result = (idWithLeadingBit & ~(1 << 32 - clz32(idWithLeadingBit) - 1)).toString(32) + JSCompiler_inline_result;
            identifierPrefix = "\xAB" + identifierPrefix + "R" + JSCompiler_inline_result;
            JSCompiler_inline_result = localIdCounter++;
            0 < JSCompiler_inline_result && (identifierPrefix += "H" + JSCompiler_inline_result.toString(32));
            identifierPrefix += "\xBB";
          } else
            JSCompiler_inline_result = globalClientIdCounter++, identifierPrefix = "\xAB" + identifierPrefix + "r" + JSCompiler_inline_result.toString(32) + "\xBB";
          return hook.memoizedState = identifierPrefix;
        },
        useHostTransitionStatus,
        useFormState: mountActionState,
        useActionState: mountActionState,
        useOptimistic: function(passthrough) {
          var hook = mountWorkInProgressHook();
          hook.memoizedState = hook.baseState = passthrough;
          var queue = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          hook.queue = queue;
          hook = dispatchOptimisticSetState.bind(
            null,
            currentlyRenderingFiber,
            true,
            queue
          );
          queue.dispatch = hook;
          return [passthrough, hook];
        },
        useMemoCache,
        useCacheRefresh: function() {
          return mountWorkInProgressHook().memoizedState = refreshCache.bind(
            null,
            currentlyRenderingFiber
          );
        }
      };
      var HooksDispatcherOnUpdate = {
        readContext,
        use,
        useCallback: updateCallback,
        useContext: readContext,
        useEffect: updateEffect,
        useImperativeHandle: updateImperativeHandle,
        useInsertionEffect: updateInsertionEffect,
        useLayoutEffect: updateLayoutEffect,
        useMemo: updateMemo,
        useReducer: updateReducer,
        useRef: updateRef,
        useState: function() {
          return updateReducer(basicStateReducer);
        },
        useDebugValue: mountDebugValue,
        useDeferredValue: function(value, initialValue) {
          var hook = updateWorkInProgressHook();
          return updateDeferredValueImpl(
            hook,
            currentHook.memoizedState,
            value,
            initialValue
          );
        },
        useTransition: function() {
          var booleanOrThenable = updateReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
          return [
            "boolean" === typeof booleanOrThenable ? booleanOrThenable : useThenable(booleanOrThenable),
            start
          ];
        },
        useSyncExternalStore: updateSyncExternalStore,
        useId: updateId,
        useHostTransitionStatus,
        useFormState: updateActionState,
        useActionState: updateActionState,
        useOptimistic: function(passthrough, reducer) {
          var hook = updateWorkInProgressHook();
          return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
        },
        useMemoCache,
        useCacheRefresh: updateRefresh
      };
      var HooksDispatcherOnRerender = {
        readContext,
        use,
        useCallback: updateCallback,
        useContext: readContext,
        useEffect: updateEffect,
        useImperativeHandle: updateImperativeHandle,
        useInsertionEffect: updateInsertionEffect,
        useLayoutEffect: updateLayoutEffect,
        useMemo: updateMemo,
        useReducer: rerenderReducer,
        useRef: updateRef,
        useState: function() {
          return rerenderReducer(basicStateReducer);
        },
        useDebugValue: mountDebugValue,
        useDeferredValue: function(value, initialValue) {
          var hook = updateWorkInProgressHook();
          return null === currentHook ? mountDeferredValueImpl(hook, value, initialValue) : updateDeferredValueImpl(
            hook,
            currentHook.memoizedState,
            value,
            initialValue
          );
        },
        useTransition: function() {
          var booleanOrThenable = rerenderReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
          return [
            "boolean" === typeof booleanOrThenable ? booleanOrThenable : useThenable(booleanOrThenable),
            start
          ];
        },
        useSyncExternalStore: updateSyncExternalStore,
        useId: updateId,
        useHostTransitionStatus,
        useFormState: rerenderActionState,
        useActionState: rerenderActionState,
        useOptimistic: function(passthrough, reducer) {
          var hook = updateWorkInProgressHook();
          if (null !== currentHook)
            return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
          hook.baseState = passthrough;
          return [passthrough, hook.queue.dispatch];
        },
        useMemoCache,
        useCacheRefresh: updateRefresh
      };
      var thenableState = null;
      var thenableIndexCounter = 0;
      function unwrapThenable(thenable) {
        var index2 = thenableIndexCounter;
        thenableIndexCounter += 1;
        null === thenableState && (thenableState = []);
        return trackUsedThenable(thenableState, thenable, index2);
      }
      function coerceRef(workInProgress2, element) {
        element = element.props.ref;
        workInProgress2.ref = void 0 !== element ? element : null;
      }
      function throwOnInvalidObjectType(returnFiber, newChild) {
        if (newChild.$$typeof === REACT_LEGACY_ELEMENT_TYPE)
          throw Error(formatProdErrorMessage(525));
        returnFiber = Object.prototype.toString.call(newChild);
        throw Error(
          formatProdErrorMessage(
            31,
            "[object Object]" === returnFiber ? "object with keys {" + Object.keys(newChild).join(", ") + "}" : returnFiber
          )
        );
      }
      function resolveLazy(lazyType) {
        var init = lazyType._init;
        return init(lazyType._payload);
      }
      function createChildReconciler(shouldTrackSideEffects) {
        function deleteChild(returnFiber, childToDelete) {
          if (shouldTrackSideEffects) {
            var deletions = returnFiber.deletions;
            null === deletions ? (returnFiber.deletions = [childToDelete], returnFiber.flags |= 16) : deletions.push(childToDelete);
          }
        }
        function deleteRemainingChildren(returnFiber, currentFirstChild) {
          if (!shouldTrackSideEffects) return null;
          for (; null !== currentFirstChild; )
            deleteChild(returnFiber, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
          return null;
        }
        function mapRemainingChildren(currentFirstChild) {
          for (var existingChildren = /* @__PURE__ */ new Map(); null !== currentFirstChild; )
            null !== currentFirstChild.key ? existingChildren.set(currentFirstChild.key, currentFirstChild) : existingChildren.set(currentFirstChild.index, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
          return existingChildren;
        }
        function useFiber(fiber, pendingProps) {
          fiber = createWorkInProgress(fiber, pendingProps);
          fiber.index = 0;
          fiber.sibling = null;
          return fiber;
        }
        function placeChild(newFiber, lastPlacedIndex, newIndex) {
          newFiber.index = newIndex;
          if (!shouldTrackSideEffects)
            return newFiber.flags |= 1048576, lastPlacedIndex;
          newIndex = newFiber.alternate;
          if (null !== newIndex)
            return newIndex = newIndex.index, newIndex < lastPlacedIndex ? (newFiber.flags |= 67108866, lastPlacedIndex) : newIndex;
          newFiber.flags |= 67108866;
          return lastPlacedIndex;
        }
        function placeSingleChild(newFiber) {
          shouldTrackSideEffects && null === newFiber.alternate && (newFiber.flags |= 67108866);
          return newFiber;
        }
        function updateTextNode(returnFiber, current, textContent, lanes) {
          if (null === current || 6 !== current.tag)
            return current = createFiberFromText(textContent, returnFiber.mode, lanes), current.return = returnFiber, current;
          current = useFiber(current, textContent);
          current.return = returnFiber;
          return current;
        }
        function updateElement(returnFiber, current, element, lanes) {
          var elementType = element.type;
          if (elementType === REACT_FRAGMENT_TYPE)
            return updateFragment(
              returnFiber,
              current,
              element.props.children,
              lanes,
              element.key
            );
          if (null !== current && (current.elementType === elementType || "object" === typeof elementType && null !== elementType && elementType.$$typeof === REACT_LAZY_TYPE && resolveLazy(elementType) === current.type))
            return current = useFiber(current, element.props), coerceRef(current, element), current.return = returnFiber, current;
          current = createFiberFromTypeAndProps(
            element.type,
            element.key,
            element.props,
            null,
            returnFiber.mode,
            lanes
          );
          coerceRef(current, element);
          current.return = returnFiber;
          return current;
        }
        function updatePortal(returnFiber, current, portal, lanes) {
          if (null === current || 4 !== current.tag || current.stateNode.containerInfo !== portal.containerInfo || current.stateNode.implementation !== portal.implementation)
            return current = createFiberFromPortal(portal, returnFiber.mode, lanes), current.return = returnFiber, current;
          current = useFiber(current, portal.children || []);
          current.return = returnFiber;
          return current;
        }
        function updateFragment(returnFiber, current, fragment, lanes, key) {
          if (null === current || 7 !== current.tag)
            return current = createFiberFromFragment(
              fragment,
              returnFiber.mode,
              lanes,
              key
            ), current.return = returnFiber, current;
          current = useFiber(current, fragment);
          current.return = returnFiber;
          return current;
        }
        function createChild(returnFiber, newChild, lanes) {
          if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
            return newChild = createFiberFromText(
              "" + newChild,
              returnFiber.mode,
              lanes
            ), newChild.return = returnFiber, newChild;
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                return lanes = createFiberFromTypeAndProps(
                  newChild.type,
                  newChild.key,
                  newChild.props,
                  null,
                  returnFiber.mode,
                  lanes
                ), coerceRef(lanes, newChild), lanes.return = returnFiber, lanes;
              case REACT_PORTAL_TYPE:
                return newChild = createFiberFromPortal(
                  newChild,
                  returnFiber.mode,
                  lanes
                ), newChild.return = returnFiber, newChild;
              case REACT_LAZY_TYPE:
                var init = newChild._init;
                newChild = init(newChild._payload);
                return createChild(returnFiber, newChild, lanes);
            }
            if (isArrayImpl(newChild) || getIteratorFn(newChild))
              return newChild = createFiberFromFragment(
                newChild,
                returnFiber.mode,
                lanes,
                null
              ), newChild.return = returnFiber, newChild;
            if ("function" === typeof newChild.then)
              return createChild(returnFiber, unwrapThenable(newChild), lanes);
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return createChild(
                returnFiber,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectType(returnFiber, newChild);
          }
          return null;
        }
        function updateSlot(returnFiber, oldFiber, newChild, lanes) {
          var key = null !== oldFiber ? oldFiber.key : null;
          if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
            return null !== key ? null : updateTextNode(returnFiber, oldFiber, "" + newChild, lanes);
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                return newChild.key === key ? updateElement(returnFiber, oldFiber, newChild, lanes) : null;
              case REACT_PORTAL_TYPE:
                return newChild.key === key ? updatePortal(returnFiber, oldFiber, newChild, lanes) : null;
              case REACT_LAZY_TYPE:
                return key = newChild._init, newChild = key(newChild._payload), updateSlot(returnFiber, oldFiber, newChild, lanes);
            }
            if (isArrayImpl(newChild) || getIteratorFn(newChild))
              return null !== key ? null : updateFragment(returnFiber, oldFiber, newChild, lanes, null);
            if ("function" === typeof newChild.then)
              return updateSlot(
                returnFiber,
                oldFiber,
                unwrapThenable(newChild),
                lanes
              );
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return updateSlot(
                returnFiber,
                oldFiber,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectType(returnFiber, newChild);
          }
          return null;
        }
        function updateFromMap(existingChildren, returnFiber, newIdx, newChild, lanes) {
          if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
            return existingChildren = existingChildren.get(newIdx) || null, updateTextNode(returnFiber, existingChildren, "" + newChild, lanes);
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                return existingChildren = existingChildren.get(
                  null === newChild.key ? newIdx : newChild.key
                ) || null, updateElement(returnFiber, existingChildren, newChild, lanes);
              case REACT_PORTAL_TYPE:
                return existingChildren = existingChildren.get(
                  null === newChild.key ? newIdx : newChild.key
                ) || null, updatePortal(returnFiber, existingChildren, newChild, lanes);
              case REACT_LAZY_TYPE:
                var init = newChild._init;
                newChild = init(newChild._payload);
                return updateFromMap(
                  existingChildren,
                  returnFiber,
                  newIdx,
                  newChild,
                  lanes
                );
            }
            if (isArrayImpl(newChild) || getIteratorFn(newChild))
              return existingChildren = existingChildren.get(newIdx) || null, updateFragment(returnFiber, existingChildren, newChild, lanes, null);
            if ("function" === typeof newChild.then)
              return updateFromMap(
                existingChildren,
                returnFiber,
                newIdx,
                unwrapThenable(newChild),
                lanes
              );
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return updateFromMap(
                existingChildren,
                returnFiber,
                newIdx,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectType(returnFiber, newChild);
          }
          return null;
        }
        function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, lanes) {
          for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null; null !== oldFiber && newIdx < newChildren.length; newIdx++) {
            oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
            var newFiber = updateSlot(
              returnFiber,
              oldFiber,
              newChildren[newIdx],
              lanes
            );
            if (null === newFiber) {
              null === oldFiber && (oldFiber = nextOldFiber);
              break;
            }
            shouldTrackSideEffects && oldFiber && null === newFiber.alternate && deleteChild(returnFiber, oldFiber);
            currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
            null === previousNewFiber ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
            previousNewFiber = newFiber;
            oldFiber = nextOldFiber;
          }
          if (newIdx === newChildren.length)
            return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
          if (null === oldFiber) {
            for (; newIdx < newChildren.length; newIdx++)
              oldFiber = createChild(returnFiber, newChildren[newIdx], lanes), null !== oldFiber && (currentFirstChild = placeChild(
                oldFiber,
                currentFirstChild,
                newIdx
              ), null === previousNewFiber ? resultingFirstChild = oldFiber : previousNewFiber.sibling = oldFiber, previousNewFiber = oldFiber);
            isHydrating && pushTreeFork(returnFiber, newIdx);
            return resultingFirstChild;
          }
          for (oldFiber = mapRemainingChildren(oldFiber); newIdx < newChildren.length; newIdx++)
            nextOldFiber = updateFromMap(
              oldFiber,
              returnFiber,
              newIdx,
              newChildren[newIdx],
              lanes
            ), null !== nextOldFiber && (shouldTrackSideEffects && null !== nextOldFiber.alternate && oldFiber.delete(
              null === nextOldFiber.key ? newIdx : nextOldFiber.key
            ), currentFirstChild = placeChild(
              nextOldFiber,
              currentFirstChild,
              newIdx
            ), null === previousNewFiber ? resultingFirstChild = nextOldFiber : previousNewFiber.sibling = nextOldFiber, previousNewFiber = nextOldFiber);
          shouldTrackSideEffects && oldFiber.forEach(function(child) {
            return deleteChild(returnFiber, child);
          });
          isHydrating && pushTreeFork(returnFiber, newIdx);
          return resultingFirstChild;
        }
        function reconcileChildrenIterator(returnFiber, currentFirstChild, newChildren, lanes) {
          if (null == newChildren) throw Error(formatProdErrorMessage(151));
          for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null, step = newChildren.next(); null !== oldFiber && !step.done; newIdx++, step = newChildren.next()) {
            oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
            var newFiber = updateSlot(returnFiber, oldFiber, step.value, lanes);
            if (null === newFiber) {
              null === oldFiber && (oldFiber = nextOldFiber);
              break;
            }
            shouldTrackSideEffects && oldFiber && null === newFiber.alternate && deleteChild(returnFiber, oldFiber);
            currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
            null === previousNewFiber ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
            previousNewFiber = newFiber;
            oldFiber = nextOldFiber;
          }
          if (step.done)
            return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
          if (null === oldFiber) {
            for (; !step.done; newIdx++, step = newChildren.next())
              step = createChild(returnFiber, step.value, lanes), null !== step && (currentFirstChild = placeChild(step, currentFirstChild, newIdx), null === previousNewFiber ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
            isHydrating && pushTreeFork(returnFiber, newIdx);
            return resultingFirstChild;
          }
          for (oldFiber = mapRemainingChildren(oldFiber); !step.done; newIdx++, step = newChildren.next())
            step = updateFromMap(oldFiber, returnFiber, newIdx, step.value, lanes), null !== step && (shouldTrackSideEffects && null !== step.alternate && oldFiber.delete(null === step.key ? newIdx : step.key), currentFirstChild = placeChild(step, currentFirstChild, newIdx), null === previousNewFiber ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
          shouldTrackSideEffects && oldFiber.forEach(function(child) {
            return deleteChild(returnFiber, child);
          });
          isHydrating && pushTreeFork(returnFiber, newIdx);
          return resultingFirstChild;
        }
        function reconcileChildFibersImpl(returnFiber, currentFirstChild, newChild, lanes) {
          "object" === typeof newChild && null !== newChild && newChild.type === REACT_FRAGMENT_TYPE && null === newChild.key && (newChild = newChild.props.children);
          if ("object" === typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                a: {
                  for (var key = newChild.key; null !== currentFirstChild; ) {
                    if (currentFirstChild.key === key) {
                      key = newChild.type;
                      if (key === REACT_FRAGMENT_TYPE) {
                        if (7 === currentFirstChild.tag) {
                          deleteRemainingChildren(
                            returnFiber,
                            currentFirstChild.sibling
                          );
                          lanes = useFiber(
                            currentFirstChild,
                            newChild.props.children
                          );
                          lanes.return = returnFiber;
                          returnFiber = lanes;
                          break a;
                        }
                      } else if (currentFirstChild.elementType === key || "object" === typeof key && null !== key && key.$$typeof === REACT_LAZY_TYPE && resolveLazy(key) === currentFirstChild.type) {
                        deleteRemainingChildren(
                          returnFiber,
                          currentFirstChild.sibling
                        );
                        lanes = useFiber(currentFirstChild, newChild.props);
                        coerceRef(lanes, newChild);
                        lanes.return = returnFiber;
                        returnFiber = lanes;
                        break a;
                      }
                      deleteRemainingChildren(returnFiber, currentFirstChild);
                      break;
                    } else deleteChild(returnFiber, currentFirstChild);
                    currentFirstChild = currentFirstChild.sibling;
                  }
                  newChild.type === REACT_FRAGMENT_TYPE ? (lanes = createFiberFromFragment(
                    newChild.props.children,
                    returnFiber.mode,
                    lanes,
                    newChild.key
                  ), lanes.return = returnFiber, returnFiber = lanes) : (lanes = createFiberFromTypeAndProps(
                    newChild.type,
                    newChild.key,
                    newChild.props,
                    null,
                    returnFiber.mode,
                    lanes
                  ), coerceRef(lanes, newChild), lanes.return = returnFiber, returnFiber = lanes);
                }
                return placeSingleChild(returnFiber);
              case REACT_PORTAL_TYPE:
                a: {
                  for (key = newChild.key; null !== currentFirstChild; ) {
                    if (currentFirstChild.key === key)
                      if (4 === currentFirstChild.tag && currentFirstChild.stateNode.containerInfo === newChild.containerInfo && currentFirstChild.stateNode.implementation === newChild.implementation) {
                        deleteRemainingChildren(
                          returnFiber,
                          currentFirstChild.sibling
                        );
                        lanes = useFiber(currentFirstChild, newChild.children || []);
                        lanes.return = returnFiber;
                        returnFiber = lanes;
                        break a;
                      } else {
                        deleteRemainingChildren(returnFiber, currentFirstChild);
                        break;
                      }
                    else deleteChild(returnFiber, currentFirstChild);
                    currentFirstChild = currentFirstChild.sibling;
                  }
                  lanes = createFiberFromPortal(newChild, returnFiber.mode, lanes);
                  lanes.return = returnFiber;
                  returnFiber = lanes;
                }
                return placeSingleChild(returnFiber);
              case REACT_LAZY_TYPE:
                return key = newChild._init, newChild = key(newChild._payload), reconcileChildFibersImpl(
                  returnFiber,
                  currentFirstChild,
                  newChild,
                  lanes
                );
            }
            if (isArrayImpl(newChild))
              return reconcileChildrenArray(
                returnFiber,
                currentFirstChild,
                newChild,
                lanes
              );
            if (getIteratorFn(newChild)) {
              key = getIteratorFn(newChild);
              if ("function" !== typeof key) throw Error(formatProdErrorMessage(150));
              newChild = key.call(newChild);
              return reconcileChildrenIterator(
                returnFiber,
                currentFirstChild,
                newChild,
                lanes
              );
            }
            if ("function" === typeof newChild.then)
              return reconcileChildFibersImpl(
                returnFiber,
                currentFirstChild,
                unwrapThenable(newChild),
                lanes
              );
            if (newChild.$$typeof === REACT_CONTEXT_TYPE)
              return reconcileChildFibersImpl(
                returnFiber,
                currentFirstChild,
                readContextDuringReconciliation(returnFiber, newChild),
                lanes
              );
            throwOnInvalidObjectType(returnFiber, newChild);
          }
          return "string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild ? (newChild = "" + newChild, null !== currentFirstChild && 6 === currentFirstChild.tag ? (deleteRemainingChildren(returnFiber, currentFirstChild.sibling), lanes = useFiber(currentFirstChild, newChild), lanes.return = returnFiber, returnFiber = lanes) : (deleteRemainingChildren(returnFiber, currentFirstChild), lanes = createFiberFromText(newChild, returnFiber.mode, lanes), lanes.return = returnFiber, returnFiber = lanes), placeSingleChild(returnFiber)) : deleteRemainingChildren(returnFiber, currentFirstChild);
        }
        return function(returnFiber, currentFirstChild, newChild, lanes) {
          try {
            thenableIndexCounter = 0;
            var firstChildFiber = reconcileChildFibersImpl(
              returnFiber,
              currentFirstChild,
              newChild,
              lanes
            );
            thenableState = null;
            return firstChildFiber;
          } catch (x) {
            if (x === SuspenseException || x === SuspenseActionException) throw x;
            var fiber = createFiberImplClass(29, x, null, returnFiber.mode);
            fiber.lanes = lanes;
            fiber.return = returnFiber;
            return fiber;
          } finally {
          }
        };
      }
      var reconcileChildFibers = createChildReconciler(true);
      var mountChildFibers = createChildReconciler(false);
      var suspenseHandlerStackCursor = createCursor(null);
      var shellBoundary = null;
      function pushPrimaryTreeSuspenseHandler(handler) {
        var current = handler.alternate;
        push(suspenseStackCursor, suspenseStackCursor.current & 1);
        push(suspenseHandlerStackCursor, handler);
        null === shellBoundary && (null === current || null !== currentTreeHiddenStackCursor.current ? shellBoundary = handler : null !== current.memoizedState && (shellBoundary = handler));
      }
      function pushOffscreenSuspenseHandler(fiber) {
        if (22 === fiber.tag) {
          if (push(suspenseStackCursor, suspenseStackCursor.current), push(suspenseHandlerStackCursor, fiber), null === shellBoundary) {
            var current = fiber.alternate;
            null !== current && null !== current.memoizedState && (shellBoundary = fiber);
          }
        } else reuseSuspenseHandlerOnStack(fiber);
      }
      function reuseSuspenseHandlerOnStack() {
        push(suspenseStackCursor, suspenseStackCursor.current);
        push(suspenseHandlerStackCursor, suspenseHandlerStackCursor.current);
      }
      function popSuspenseHandler(fiber) {
        pop(suspenseHandlerStackCursor);
        shellBoundary === fiber && (shellBoundary = null);
        pop(suspenseStackCursor);
      }
      var suspenseStackCursor = createCursor(0);
      function findFirstSuspended(row) {
        for (var node = row; null !== node; ) {
          if (13 === node.tag) {
            var state = node.memoizedState;
            if (null !== state && (state = state.dehydrated, null === state || "$?" === state.data || isSuspenseInstanceFallback(state)))
              return node;
          } else if (19 === node.tag && void 0 !== node.memoizedProps.revealOrder) {
            if (0 !== (node.flags & 128)) return node;
          } else if (null !== node.child) {
            node.child.return = node;
            node = node.child;
            continue;
          }
          if (node === row) break;
          for (; null === node.sibling; ) {
            if (null === node.return || node.return === row) return null;
            node = node.return;
          }
          node.sibling.return = node.return;
          node = node.sibling;
        }
        return null;
      }
      function applyDerivedStateFromProps(workInProgress2, ctor, getDerivedStateFromProps, nextProps) {
        ctor = workInProgress2.memoizedState;
        getDerivedStateFromProps = getDerivedStateFromProps(nextProps, ctor);
        getDerivedStateFromProps = null === getDerivedStateFromProps || void 0 === getDerivedStateFromProps ? ctor : assign({}, ctor, getDerivedStateFromProps);
        workInProgress2.memoizedState = getDerivedStateFromProps;
        0 === workInProgress2.lanes && (workInProgress2.updateQueue.baseState = getDerivedStateFromProps);
      }
      var classComponentUpdater = {
        enqueueSetState: function(inst, payload, callback) {
          inst = inst._reactInternals;
          var lane = requestUpdateLane(), update2 = createUpdate(lane);
          update2.payload = payload;
          void 0 !== callback && null !== callback && (update2.callback = callback);
          payload = enqueueUpdate(inst, update2, lane);
          null !== payload && (scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
        },
        enqueueReplaceState: function(inst, payload, callback) {
          inst = inst._reactInternals;
          var lane = requestUpdateLane(), update2 = createUpdate(lane);
          update2.tag = 1;
          update2.payload = payload;
          void 0 !== callback && null !== callback && (update2.callback = callback);
          payload = enqueueUpdate(inst, update2, lane);
          null !== payload && (scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
        },
        enqueueForceUpdate: function(inst, callback) {
          inst = inst._reactInternals;
          var lane = requestUpdateLane(), update2 = createUpdate(lane);
          update2.tag = 2;
          void 0 !== callback && null !== callback && (update2.callback = callback);
          callback = enqueueUpdate(inst, update2, lane);
          null !== callback && (scheduleUpdateOnFiber(callback, inst, lane), entangleTransitions(callback, inst, lane));
        }
      };
      function checkShouldComponentUpdate(workInProgress2, ctor, oldProps, newProps, oldState, newState, nextContext) {
        workInProgress2 = workInProgress2.stateNode;
        return "function" === typeof workInProgress2.shouldComponentUpdate ? workInProgress2.shouldComponentUpdate(newProps, newState, nextContext) : ctor.prototype && ctor.prototype.isPureReactComponent ? !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState) : true;
      }
      function callComponentWillReceiveProps(workInProgress2, instance, newProps, nextContext) {
        workInProgress2 = instance.state;
        "function" === typeof instance.componentWillReceiveProps && instance.componentWillReceiveProps(newProps, nextContext);
        "function" === typeof instance.UNSAFE_componentWillReceiveProps && instance.UNSAFE_componentWillReceiveProps(newProps, nextContext);
        instance.state !== workInProgress2 && classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
      }
      function resolveClassComponentProps(Component2, baseProps) {
        var newProps = baseProps;
        if ("ref" in baseProps) {
          newProps = {};
          for (var propName in baseProps)
            "ref" !== propName && (newProps[propName] = baseProps[propName]);
        }
        if (Component2 = Component2.defaultProps) {
          newProps === baseProps && (newProps = assign({}, newProps));
          for (var propName$73 in Component2)
            void 0 === newProps[propName$73] && (newProps[propName$73] = Component2[propName$73]);
        }
        return newProps;
      }
      var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      };
      function defaultOnUncaughtError(error) {
        reportGlobalError(error);
      }
      function defaultOnCaughtError(error) {
        console.error(error);
      }
      function defaultOnRecoverableError(error) {
        reportGlobalError(error);
      }
      function logUncaughtError(root2, errorInfo) {
        try {
          var onUncaughtError = root2.onUncaughtError;
          onUncaughtError(errorInfo.value, { componentStack: errorInfo.stack });
        } catch (e$74) {
          setTimeout(function() {
            throw e$74;
          });
        }
      }
      function logCaughtError(root2, boundary, errorInfo) {
        try {
          var onCaughtError = root2.onCaughtError;
          onCaughtError(errorInfo.value, {
            componentStack: errorInfo.stack,
            errorBoundary: 1 === boundary.tag ? boundary.stateNode : null
          });
        } catch (e$75) {
          setTimeout(function() {
            throw e$75;
          });
        }
      }
      function createRootErrorUpdate(root2, errorInfo, lane) {
        lane = createUpdate(lane);
        lane.tag = 3;
        lane.payload = { element: null };
        lane.callback = function() {
          logUncaughtError(root2, errorInfo);
        };
        return lane;
      }
      function createClassErrorUpdate(lane) {
        lane = createUpdate(lane);
        lane.tag = 3;
        return lane;
      }
      function initializeClassErrorUpdate(update2, root2, fiber, errorInfo) {
        var getDerivedStateFromError = fiber.type.getDerivedStateFromError;
        if ("function" === typeof getDerivedStateFromError) {
          var error = errorInfo.value;
          update2.payload = function() {
            return getDerivedStateFromError(error);
          };
          update2.callback = function() {
            logCaughtError(root2, fiber, errorInfo);
          };
        }
        var inst = fiber.stateNode;
        null !== inst && "function" === typeof inst.componentDidCatch && (update2.callback = function() {
          logCaughtError(root2, fiber, errorInfo);
          "function" !== typeof getDerivedStateFromError && (null === legacyErrorBoundariesThatAlreadyFailed ? legacyErrorBoundariesThatAlreadyFailed = /* @__PURE__ */ new Set([this]) : legacyErrorBoundariesThatAlreadyFailed.add(this));
          var stack = errorInfo.stack;
          this.componentDidCatch(errorInfo.value, {
            componentStack: null !== stack ? stack : ""
          });
        });
      }
      function throwException(root2, returnFiber, sourceFiber, value, rootRenderLanes) {
        sourceFiber.flags |= 32768;
        if (null !== value && "object" === typeof value && "function" === typeof value.then) {
          returnFiber = sourceFiber.alternate;
          null !== returnFiber && propagateParentContextChanges(
            returnFiber,
            sourceFiber,
            rootRenderLanes,
            true
          );
          sourceFiber = suspenseHandlerStackCursor.current;
          if (null !== sourceFiber) {
            switch (sourceFiber.tag) {
              case 13:
                return null === shellBoundary ? renderDidSuspendDelayIfPossible() : null === sourceFiber.alternate && 0 === workInProgressRootExitStatus && (workInProgressRootExitStatus = 3), sourceFiber.flags &= -257, sourceFiber.flags |= 65536, sourceFiber.lanes = rootRenderLanes, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, null === returnFiber ? sourceFiber.updateQueue = /* @__PURE__ */ new Set([value]) : returnFiber.add(value), attachPingListener(root2, value, rootRenderLanes)), false;
              case 22:
                return sourceFiber.flags |= 65536, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, null === returnFiber ? (returnFiber = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([value])
                }, sourceFiber.updateQueue = returnFiber) : (sourceFiber = returnFiber.retryQueue, null === sourceFiber ? returnFiber.retryQueue = /* @__PURE__ */ new Set([value]) : sourceFiber.add(value)), attachPingListener(root2, value, rootRenderLanes)), false;
            }
            throw Error(formatProdErrorMessage(435, sourceFiber.tag));
          }
          attachPingListener(root2, value, rootRenderLanes);
          renderDidSuspendDelayIfPossible();
          return false;
        }
        if (isHydrating)
          return returnFiber = suspenseHandlerStackCursor.current, null !== returnFiber ? (0 === (returnFiber.flags & 65536) && (returnFiber.flags |= 256), returnFiber.flags |= 65536, returnFiber.lanes = rootRenderLanes, value !== HydrationMismatchException && (root2 = Error(formatProdErrorMessage(422), { cause: value }), queueHydrationError(createCapturedValueAtFiber(root2, sourceFiber)))) : (value !== HydrationMismatchException && (returnFiber = Error(formatProdErrorMessage(423), {
            cause: value
          }), queueHydrationError(
            createCapturedValueAtFiber(returnFiber, sourceFiber)
          )), root2 = root2.current.alternate, root2.flags |= 65536, rootRenderLanes &= -rootRenderLanes, root2.lanes |= rootRenderLanes, value = createCapturedValueAtFiber(value, sourceFiber), rootRenderLanes = createRootErrorUpdate(
            root2.stateNode,
            value,
            rootRenderLanes
          ), enqueueCapturedUpdate(root2, rootRenderLanes), 4 !== workInProgressRootExitStatus && (workInProgressRootExitStatus = 2)), false;
        var wrapperError = Error(formatProdErrorMessage(520), { cause: value });
        wrapperError = createCapturedValueAtFiber(wrapperError, sourceFiber);
        null === workInProgressRootConcurrentErrors ? workInProgressRootConcurrentErrors = [wrapperError] : workInProgressRootConcurrentErrors.push(wrapperError);
        4 !== workInProgressRootExitStatus && (workInProgressRootExitStatus = 2);
        if (null === returnFiber) return true;
        value = createCapturedValueAtFiber(value, sourceFiber);
        sourceFiber = returnFiber;
        do {
          switch (sourceFiber.tag) {
            case 3:
              return sourceFiber.flags |= 65536, root2 = rootRenderLanes & -rootRenderLanes, sourceFiber.lanes |= root2, root2 = createRootErrorUpdate(sourceFiber.stateNode, value, root2), enqueueCapturedUpdate(sourceFiber, root2), false;
            case 1:
              if (returnFiber = sourceFiber.type, wrapperError = sourceFiber.stateNode, 0 === (sourceFiber.flags & 128) && ("function" === typeof returnFiber.getDerivedStateFromError || null !== wrapperError && "function" === typeof wrapperError.componentDidCatch && (null === legacyErrorBoundariesThatAlreadyFailed || !legacyErrorBoundariesThatAlreadyFailed.has(wrapperError))))
                return sourceFiber.flags |= 65536, rootRenderLanes &= -rootRenderLanes, sourceFiber.lanes |= rootRenderLanes, rootRenderLanes = createClassErrorUpdate(rootRenderLanes), initializeClassErrorUpdate(
                  rootRenderLanes,
                  root2,
                  sourceFiber,
                  value
                ), enqueueCapturedUpdate(sourceFiber, rootRenderLanes), false;
          }
          sourceFiber = sourceFiber.return;
        } while (null !== sourceFiber);
        return false;
      }
      var SelectiveHydrationException = Error(formatProdErrorMessage(461));
      var didReceiveUpdate = false;
      function reconcileChildren(current, workInProgress2, nextChildren, renderLanes2) {
        workInProgress2.child = null === current ? mountChildFibers(workInProgress2, null, nextChildren, renderLanes2) : reconcileChildFibers(
          workInProgress2,
          current.child,
          nextChildren,
          renderLanes2
        );
      }
      function updateForwardRef(current, workInProgress2, Component2, nextProps, renderLanes2) {
        Component2 = Component2.render;
        var ref = workInProgress2.ref;
        if ("ref" in nextProps) {
          var propsWithoutRef = {};
          for (var key in nextProps)
            "ref" !== key && (propsWithoutRef[key] = nextProps[key]);
        } else propsWithoutRef = nextProps;
        prepareToReadContext(workInProgress2);
        nextProps = renderWithHooks(
          current,
          workInProgress2,
          Component2,
          propsWithoutRef,
          ref,
          renderLanes2
        );
        key = checkDidRenderIdHook();
        if (null !== current && !didReceiveUpdate)
          return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        isHydrating && key && pushMaterializedTreeId(workInProgress2);
        workInProgress2.flags |= 1;
        reconcileChildren(current, workInProgress2, nextProps, renderLanes2);
        return workInProgress2.child;
      }
      function updateMemoComponent(current, workInProgress2, Component2, nextProps, renderLanes2) {
        if (null === current) {
          var type = Component2.type;
          if ("function" === typeof type && !shouldConstruct(type) && void 0 === type.defaultProps && null === Component2.compare)
            return workInProgress2.tag = 15, workInProgress2.type = type, updateSimpleMemoComponent(
              current,
              workInProgress2,
              type,
              nextProps,
              renderLanes2
            );
          current = createFiberFromTypeAndProps(
            Component2.type,
            null,
            nextProps,
            workInProgress2,
            workInProgress2.mode,
            renderLanes2
          );
          current.ref = workInProgress2.ref;
          current.return = workInProgress2;
          return workInProgress2.child = current;
        }
        type = current.child;
        if (!checkScheduledUpdateOrContext(current, renderLanes2)) {
          var prevProps = type.memoizedProps;
          Component2 = Component2.compare;
          Component2 = null !== Component2 ? Component2 : shallowEqual;
          if (Component2(prevProps, nextProps) && current.ref === workInProgress2.ref)
            return bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        }
        workInProgress2.flags |= 1;
        current = createWorkInProgress(type, nextProps);
        current.ref = workInProgress2.ref;
        current.return = workInProgress2;
        return workInProgress2.child = current;
      }
      function updateSimpleMemoComponent(current, workInProgress2, Component2, nextProps, renderLanes2) {
        if (null !== current) {
          var prevProps = current.memoizedProps;
          if (shallowEqual(prevProps, nextProps) && current.ref === workInProgress2.ref)
            if (didReceiveUpdate = false, workInProgress2.pendingProps = nextProps = prevProps, checkScheduledUpdateOrContext(current, renderLanes2))
              0 !== (current.flags & 131072) && (didReceiveUpdate = true);
            else
              return workInProgress2.lanes = current.lanes, bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        }
        return updateFunctionComponent(
          current,
          workInProgress2,
          Component2,
          nextProps,
          renderLanes2
        );
      }
      function updateOffscreenComponent(current, workInProgress2, renderLanes2) {
        var nextProps = workInProgress2.pendingProps, nextChildren = nextProps.children, prevState = null !== current ? current.memoizedState : null;
        if ("hidden" === nextProps.mode) {
          if (0 !== (workInProgress2.flags & 128)) {
            nextProps = null !== prevState ? prevState.baseLanes | renderLanes2 : renderLanes2;
            if (null !== current) {
              nextChildren = workInProgress2.child = current.child;
              for (prevState = 0; null !== nextChildren; )
                prevState = prevState | nextChildren.lanes | nextChildren.childLanes, nextChildren = nextChildren.sibling;
              workInProgress2.childLanes = prevState & ~nextProps;
            } else workInProgress2.childLanes = 0, workInProgress2.child = null;
            return deferHiddenOffscreenComponent(
              current,
              workInProgress2,
              nextProps,
              renderLanes2
            );
          }
          if (0 !== (renderLanes2 & 536870912))
            workInProgress2.memoizedState = { baseLanes: 0, cachePool: null }, null !== current && pushTransition(
              workInProgress2,
              null !== prevState ? prevState.cachePool : null
            ), null !== prevState ? pushHiddenContext(workInProgress2, prevState) : reuseHiddenContextOnStack(), pushOffscreenSuspenseHandler(workInProgress2);
          else
            return workInProgress2.lanes = workInProgress2.childLanes = 536870912, deferHiddenOffscreenComponent(
              current,
              workInProgress2,
              null !== prevState ? prevState.baseLanes | renderLanes2 : renderLanes2,
              renderLanes2
            );
        } else
          null !== prevState ? (pushTransition(workInProgress2, prevState.cachePool), pushHiddenContext(workInProgress2, prevState), reuseSuspenseHandlerOnStack(workInProgress2), workInProgress2.memoizedState = null) : (null !== current && pushTransition(workInProgress2, null), reuseHiddenContextOnStack(), reuseSuspenseHandlerOnStack(workInProgress2));
        reconcileChildren(current, workInProgress2, nextChildren, renderLanes2);
        return workInProgress2.child;
      }
      function deferHiddenOffscreenComponent(current, workInProgress2, nextBaseLanes, renderLanes2) {
        var JSCompiler_inline_result = peekCacheFromPool();
        JSCompiler_inline_result = null === JSCompiler_inline_result ? null : { parent: CacheContext._currentValue, pool: JSCompiler_inline_result };
        workInProgress2.memoizedState = {
          baseLanes: nextBaseLanes,
          cachePool: JSCompiler_inline_result
        };
        null !== current && pushTransition(workInProgress2, null);
        reuseHiddenContextOnStack();
        pushOffscreenSuspenseHandler(workInProgress2);
        null !== current && propagateParentContextChanges(current, workInProgress2, renderLanes2, true);
        return null;
      }
      function markRef(current, workInProgress2) {
        var ref = workInProgress2.ref;
        if (null === ref)
          null !== current && null !== current.ref && (workInProgress2.flags |= 4194816);
        else {
          if ("function" !== typeof ref && "object" !== typeof ref)
            throw Error(formatProdErrorMessage(284));
          if (null === current || current.ref !== ref)
            workInProgress2.flags |= 4194816;
        }
      }
      function updateFunctionComponent(current, workInProgress2, Component2, nextProps, renderLanes2) {
        prepareToReadContext(workInProgress2);
        Component2 = renderWithHooks(
          current,
          workInProgress2,
          Component2,
          nextProps,
          void 0,
          renderLanes2
        );
        nextProps = checkDidRenderIdHook();
        if (null !== current && !didReceiveUpdate)
          return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        isHydrating && nextProps && pushMaterializedTreeId(workInProgress2);
        workInProgress2.flags |= 1;
        reconcileChildren(current, workInProgress2, Component2, renderLanes2);
        return workInProgress2.child;
      }
      function replayFunctionComponent(current, workInProgress2, nextProps, Component2, secondArg, renderLanes2) {
        prepareToReadContext(workInProgress2);
        workInProgress2.updateQueue = null;
        nextProps = renderWithHooksAgain(
          workInProgress2,
          Component2,
          nextProps,
          secondArg
        );
        finishRenderingHooks(current);
        Component2 = checkDidRenderIdHook();
        if (null !== current && !didReceiveUpdate)
          return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
        isHydrating && Component2 && pushMaterializedTreeId(workInProgress2);
        workInProgress2.flags |= 1;
        reconcileChildren(current, workInProgress2, nextProps, renderLanes2);
        return workInProgress2.child;
      }
      function updateClassComponent(current, workInProgress2, Component2, nextProps, renderLanes2) {
        prepareToReadContext(workInProgress2);
        if (null === workInProgress2.stateNode) {
          var context = emptyContextObject, contextType = Component2.contextType;
          "object" === typeof contextType && null !== contextType && (context = readContext(contextType));
          context = new Component2(nextProps, context);
          workInProgress2.memoizedState = null !== context.state && void 0 !== context.state ? context.state : null;
          context.updater = classComponentUpdater;
          workInProgress2.stateNode = context;
          context._reactInternals = workInProgress2;
          context = workInProgress2.stateNode;
          context.props = nextProps;
          context.state = workInProgress2.memoizedState;
          context.refs = {};
          initializeUpdateQueue(workInProgress2);
          contextType = Component2.contextType;
          context.context = "object" === typeof contextType && null !== contextType ? readContext(contextType) : emptyContextObject;
          context.state = workInProgress2.memoizedState;
          contextType = Component2.getDerivedStateFromProps;
          "function" === typeof contextType && (applyDerivedStateFromProps(
            workInProgress2,
            Component2,
            contextType,
            nextProps
          ), context.state = workInProgress2.memoizedState);
          "function" === typeof Component2.getDerivedStateFromProps || "function" === typeof context.getSnapshotBeforeUpdate || "function" !== typeof context.UNSAFE_componentWillMount && "function" !== typeof context.componentWillMount || (contextType = context.state, "function" === typeof context.componentWillMount && context.componentWillMount(), "function" === typeof context.UNSAFE_componentWillMount && context.UNSAFE_componentWillMount(), contextType !== context.state && classComponentUpdater.enqueueReplaceState(context, context.state, null), processUpdateQueue(workInProgress2, nextProps, context, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction(), context.state = workInProgress2.memoizedState);
          "function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308);
          nextProps = true;
        } else if (null === current) {
          context = workInProgress2.stateNode;
          var unresolvedOldProps = workInProgress2.memoizedProps, oldProps = resolveClassComponentProps(Component2, unresolvedOldProps);
          context.props = oldProps;
          var oldContext = context.context, contextType$jscomp$0 = Component2.contextType;
          contextType = emptyContextObject;
          "object" === typeof contextType$jscomp$0 && null !== contextType$jscomp$0 && (contextType = readContext(contextType$jscomp$0));
          var getDerivedStateFromProps = Component2.getDerivedStateFromProps;
          contextType$jscomp$0 = "function" === typeof getDerivedStateFromProps || "function" === typeof context.getSnapshotBeforeUpdate;
          unresolvedOldProps = workInProgress2.pendingProps !== unresolvedOldProps;
          contextType$jscomp$0 || "function" !== typeof context.UNSAFE_componentWillReceiveProps && "function" !== typeof context.componentWillReceiveProps || (unresolvedOldProps || oldContext !== contextType) && callComponentWillReceiveProps(
            workInProgress2,
            context,
            nextProps,
            contextType
          );
          hasForceUpdate = false;
          var oldState = workInProgress2.memoizedState;
          context.state = oldState;
          processUpdateQueue(workInProgress2, nextProps, context, renderLanes2);
          suspendIfUpdateReadFromEntangledAsyncAction();
          oldContext = workInProgress2.memoizedState;
          unresolvedOldProps || oldState !== oldContext || hasForceUpdate ? ("function" === typeof getDerivedStateFromProps && (applyDerivedStateFromProps(
            workInProgress2,
            Component2,
            getDerivedStateFromProps,
            nextProps
          ), oldContext = workInProgress2.memoizedState), (oldProps = hasForceUpdate || checkShouldComponentUpdate(
            workInProgress2,
            Component2,
            oldProps,
            nextProps,
            oldState,
            oldContext,
            contextType
          )) ? (contextType$jscomp$0 || "function" !== typeof context.UNSAFE_componentWillMount && "function" !== typeof context.componentWillMount || ("function" === typeof context.componentWillMount && context.componentWillMount(), "function" === typeof context.UNSAFE_componentWillMount && context.UNSAFE_componentWillMount()), "function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308)) : ("function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308), workInProgress2.memoizedProps = nextProps, workInProgress2.memoizedState = oldContext), context.props = nextProps, context.state = oldContext, context.context = contextType, nextProps = oldProps) : ("function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308), nextProps = false);
        } else {
          context = workInProgress2.stateNode;
          cloneUpdateQueue(current, workInProgress2);
          contextType = workInProgress2.memoizedProps;
          contextType$jscomp$0 = resolveClassComponentProps(Component2, contextType);
          context.props = contextType$jscomp$0;
          getDerivedStateFromProps = workInProgress2.pendingProps;
          oldState = context.context;
          oldContext = Component2.contextType;
          oldProps = emptyContextObject;
          "object" === typeof oldContext && null !== oldContext && (oldProps = readContext(oldContext));
          unresolvedOldProps = Component2.getDerivedStateFromProps;
          (oldContext = "function" === typeof unresolvedOldProps || "function" === typeof context.getSnapshotBeforeUpdate) || "function" !== typeof context.UNSAFE_componentWillReceiveProps && "function" !== typeof context.componentWillReceiveProps || (contextType !== getDerivedStateFromProps || oldState !== oldProps) && callComponentWillReceiveProps(
            workInProgress2,
            context,
            nextProps,
            oldProps
          );
          hasForceUpdate = false;
          oldState = workInProgress2.memoizedState;
          context.state = oldState;
          processUpdateQueue(workInProgress2, nextProps, context, renderLanes2);
          suspendIfUpdateReadFromEntangledAsyncAction();
          var newState = workInProgress2.memoizedState;
          contextType !== getDerivedStateFromProps || oldState !== newState || hasForceUpdate || null !== current && null !== current.dependencies && checkIfContextChanged(current.dependencies) ? ("function" === typeof unresolvedOldProps && (applyDerivedStateFromProps(
            workInProgress2,
            Component2,
            unresolvedOldProps,
            nextProps
          ), newState = workInProgress2.memoizedState), (contextType$jscomp$0 = hasForceUpdate || checkShouldComponentUpdate(
            workInProgress2,
            Component2,
            contextType$jscomp$0,
            nextProps,
            oldState,
            newState,
            oldProps
          ) || null !== current && null !== current.dependencies && checkIfContextChanged(current.dependencies)) ? (oldContext || "function" !== typeof context.UNSAFE_componentWillUpdate && "function" !== typeof context.componentWillUpdate || ("function" === typeof context.componentWillUpdate && context.componentWillUpdate(nextProps, newState, oldProps), "function" === typeof context.UNSAFE_componentWillUpdate && context.UNSAFE_componentWillUpdate(
            nextProps,
            newState,
            oldProps
          )), "function" === typeof context.componentDidUpdate && (workInProgress2.flags |= 4), "function" === typeof context.getSnapshotBeforeUpdate && (workInProgress2.flags |= 1024)) : ("function" !== typeof context.componentDidUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 4), "function" !== typeof context.getSnapshotBeforeUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 1024), workInProgress2.memoizedProps = nextProps, workInProgress2.memoizedState = newState), context.props = nextProps, context.state = newState, context.context = oldProps, nextProps = contextType$jscomp$0) : ("function" !== typeof context.componentDidUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 4), "function" !== typeof context.getSnapshotBeforeUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 1024), nextProps = false);
        }
        context = nextProps;
        markRef(current, workInProgress2);
        nextProps = 0 !== (workInProgress2.flags & 128);
        context || nextProps ? (context = workInProgress2.stateNode, Component2 = nextProps && "function" !== typeof Component2.getDerivedStateFromError ? null : context.render(), workInProgress2.flags |= 1, null !== current && nextProps ? (workInProgress2.child = reconcileChildFibers(
          workInProgress2,
          current.child,
          null,
          renderLanes2
        ), workInProgress2.child = reconcileChildFibers(
          workInProgress2,
          null,
          Component2,
          renderLanes2
        )) : reconcileChildren(current, workInProgress2, Component2, renderLanes2), workInProgress2.memoizedState = context.state, current = workInProgress2.child) : current = bailoutOnAlreadyFinishedWork(
          current,
          workInProgress2,
          renderLanes2
        );
        return current;
      }
      function mountHostRootWithoutHydrating(current, workInProgress2, nextChildren, renderLanes2) {
        resetHydrationState();
        workInProgress2.flags |= 256;
        reconcileChildren(current, workInProgress2, nextChildren, renderLanes2);
        return workInProgress2.child;
      }
      var SUSPENDED_MARKER = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      };
      function mountSuspenseOffscreenState(renderLanes2) {
        return { baseLanes: renderLanes2, cachePool: getSuspendedCache() };
      }
      function getRemainingWorkInPrimaryTree(current, primaryTreeDidDefer, renderLanes2) {
        current = null !== current ? current.childLanes & ~renderLanes2 : 0;
        primaryTreeDidDefer && (current |= workInProgressDeferredLane);
        return current;
      }
      function updateSuspenseComponent(current, workInProgress2, renderLanes2) {
        var nextProps = workInProgress2.pendingProps, showFallback = false, didSuspend = 0 !== (workInProgress2.flags & 128), JSCompiler_temp;
        (JSCompiler_temp = didSuspend) || (JSCompiler_temp = null !== current && null === current.memoizedState ? false : 0 !== (suspenseStackCursor.current & 2));
        JSCompiler_temp && (showFallback = true, workInProgress2.flags &= -129);
        JSCompiler_temp = 0 !== (workInProgress2.flags & 32);
        workInProgress2.flags &= -33;
        if (null === current) {
          if (isHydrating) {
            showFallback ? pushPrimaryTreeSuspenseHandler(workInProgress2) : reuseSuspenseHandlerOnStack(workInProgress2);
            if (isHydrating) {
              var nextInstance = nextHydratableInstance, JSCompiler_temp$jscomp$0;
              if (JSCompiler_temp$jscomp$0 = nextInstance) {
                c: {
                  JSCompiler_temp$jscomp$0 = nextInstance;
                  for (nextInstance = rootOrSingletonContext; 8 !== JSCompiler_temp$jscomp$0.nodeType; ) {
                    if (!nextInstance) {
                      nextInstance = null;
                      break c;
                    }
                    JSCompiler_temp$jscomp$0 = getNextHydratable(
                      JSCompiler_temp$jscomp$0.nextSibling
                    );
                    if (null === JSCompiler_temp$jscomp$0) {
                      nextInstance = null;
                      break c;
                    }
                  }
                  nextInstance = JSCompiler_temp$jscomp$0;
                }
                null !== nextInstance ? (workInProgress2.memoizedState = {
                  dehydrated: nextInstance,
                  treeContext: null !== treeContextProvider ? { id: treeContextId, overflow: treeContextOverflow } : null,
                  retryLane: 536870912,
                  hydrationErrors: null
                }, JSCompiler_temp$jscomp$0 = createFiberImplClass(
                  18,
                  null,
                  null,
                  0
                ), JSCompiler_temp$jscomp$0.stateNode = nextInstance, JSCompiler_temp$jscomp$0.return = workInProgress2, workInProgress2.child = JSCompiler_temp$jscomp$0, hydrationParentFiber = workInProgress2, nextHydratableInstance = null, JSCompiler_temp$jscomp$0 = true) : JSCompiler_temp$jscomp$0 = false;
              }
              JSCompiler_temp$jscomp$0 || throwOnHydrationMismatch(workInProgress2);
            }
            nextInstance = workInProgress2.memoizedState;
            if (null !== nextInstance && (nextInstance = nextInstance.dehydrated, null !== nextInstance))
              return isSuspenseInstanceFallback(nextInstance) ? workInProgress2.lanes = 32 : workInProgress2.lanes = 536870912, null;
            popSuspenseHandler(workInProgress2);
          }
          nextInstance = nextProps.children;
          nextProps = nextProps.fallback;
          if (showFallback)
            return reuseSuspenseHandlerOnStack(workInProgress2), showFallback = workInProgress2.mode, nextInstance = mountWorkInProgressOffscreenFiber(
              { mode: "hidden", children: nextInstance },
              showFallback
            ), nextProps = createFiberFromFragment(
              nextProps,
              showFallback,
              renderLanes2,
              null
            ), nextInstance.return = workInProgress2, nextProps.return = workInProgress2, nextInstance.sibling = nextProps, workInProgress2.child = nextInstance, showFallback = workInProgress2.child, showFallback.memoizedState = mountSuspenseOffscreenState(renderLanes2), showFallback.childLanes = getRemainingWorkInPrimaryTree(
              current,
              JSCompiler_temp,
              renderLanes2
            ), workInProgress2.memoizedState = SUSPENDED_MARKER, nextProps;
          pushPrimaryTreeSuspenseHandler(workInProgress2);
          return mountSuspensePrimaryChildren(workInProgress2, nextInstance);
        }
        JSCompiler_temp$jscomp$0 = current.memoizedState;
        if (null !== JSCompiler_temp$jscomp$0 && (nextInstance = JSCompiler_temp$jscomp$0.dehydrated, null !== nextInstance)) {
          if (didSuspend)
            workInProgress2.flags & 256 ? (pushPrimaryTreeSuspenseHandler(workInProgress2), workInProgress2.flags &= -257, workInProgress2 = retrySuspenseComponentWithoutHydrating(
              current,
              workInProgress2,
              renderLanes2
            )) : null !== workInProgress2.memoizedState ? (reuseSuspenseHandlerOnStack(workInProgress2), workInProgress2.child = current.child, workInProgress2.flags |= 128, workInProgress2 = null) : (reuseSuspenseHandlerOnStack(workInProgress2), showFallback = nextProps.fallback, nextInstance = workInProgress2.mode, nextProps = mountWorkInProgressOffscreenFiber(
              { mode: "visible", children: nextProps.children },
              nextInstance
            ), showFallback = createFiberFromFragment(
              showFallback,
              nextInstance,
              renderLanes2,
              null
            ), showFallback.flags |= 2, nextProps.return = workInProgress2, showFallback.return = workInProgress2, nextProps.sibling = showFallback, workInProgress2.child = nextProps, reconcileChildFibers(
              workInProgress2,
              current.child,
              null,
              renderLanes2
            ), nextProps = workInProgress2.child, nextProps.memoizedState = mountSuspenseOffscreenState(renderLanes2), nextProps.childLanes = getRemainingWorkInPrimaryTree(
              current,
              JSCompiler_temp,
              renderLanes2
            ), workInProgress2.memoizedState = SUSPENDED_MARKER, workInProgress2 = showFallback);
          else if (pushPrimaryTreeSuspenseHandler(workInProgress2), isSuspenseInstanceFallback(nextInstance)) {
            JSCompiler_temp = nextInstance.nextSibling && nextInstance.nextSibling.dataset;
            if (JSCompiler_temp) var digest = JSCompiler_temp.dgst;
            JSCompiler_temp = digest;
            nextProps = Error(formatProdErrorMessage(419));
            nextProps.stack = "";
            nextProps.digest = JSCompiler_temp;
            queueHydrationError({ value: nextProps, source: null, stack: null });
            workInProgress2 = retrySuspenseComponentWithoutHydrating(
              current,
              workInProgress2,
              renderLanes2
            );
          } else if (didReceiveUpdate || propagateParentContextChanges(current, workInProgress2, renderLanes2, false), JSCompiler_temp = 0 !== (renderLanes2 & current.childLanes), didReceiveUpdate || JSCompiler_temp) {
            JSCompiler_temp = workInProgressRoot;
            if (null !== JSCompiler_temp && (nextProps = renderLanes2 & -renderLanes2, nextProps = 0 !== (nextProps & 42) ? 1 : getBumpedLaneForHydrationByLane(nextProps), nextProps = 0 !== (nextProps & (JSCompiler_temp.suspendedLanes | renderLanes2)) ? 0 : nextProps, 0 !== nextProps && nextProps !== JSCompiler_temp$jscomp$0.retryLane))
              throw JSCompiler_temp$jscomp$0.retryLane = nextProps, enqueueConcurrentRenderForLane(current, nextProps), scheduleUpdateOnFiber(JSCompiler_temp, current, nextProps), SelectiveHydrationException;
            "$?" === nextInstance.data || renderDidSuspendDelayIfPossible();
            workInProgress2 = retrySuspenseComponentWithoutHydrating(
              current,
              workInProgress2,
              renderLanes2
            );
          } else
            "$?" === nextInstance.data ? (workInProgress2.flags |= 192, workInProgress2.child = current.child, workInProgress2 = null) : (current = JSCompiler_temp$jscomp$0.treeContext, nextHydratableInstance = getNextHydratable(
              nextInstance.nextSibling
            ), hydrationParentFiber = workInProgress2, isHydrating = true, hydrationErrors = null, rootOrSingletonContext = false, null !== current && (idStack[idStackIndex++] = treeContextId, idStack[idStackIndex++] = treeContextOverflow, idStack[idStackIndex++] = treeContextProvider, treeContextId = current.id, treeContextOverflow = current.overflow, treeContextProvider = workInProgress2), workInProgress2 = mountSuspensePrimaryChildren(
              workInProgress2,
              nextProps.children
            ), workInProgress2.flags |= 4096);
          return workInProgress2;
        }
        if (showFallback)
          return reuseSuspenseHandlerOnStack(workInProgress2), showFallback = nextProps.fallback, nextInstance = workInProgress2.mode, JSCompiler_temp$jscomp$0 = current.child, digest = JSCompiler_temp$jscomp$0.sibling, nextProps = createWorkInProgress(JSCompiler_temp$jscomp$0, {
            mode: "hidden",
            children: nextProps.children
          }), nextProps.subtreeFlags = JSCompiler_temp$jscomp$0.subtreeFlags & 65011712, null !== digest ? showFallback = createWorkInProgress(digest, showFallback) : (showFallback = createFiberFromFragment(
            showFallback,
            nextInstance,
            renderLanes2,
            null
          ), showFallback.flags |= 2), showFallback.return = workInProgress2, nextProps.return = workInProgress2, nextProps.sibling = showFallback, workInProgress2.child = nextProps, nextProps = showFallback, showFallback = workInProgress2.child, nextInstance = current.child.memoizedState, null === nextInstance ? nextInstance = mountSuspenseOffscreenState(renderLanes2) : (JSCompiler_temp$jscomp$0 = nextInstance.cachePool, null !== JSCompiler_temp$jscomp$0 ? (digest = CacheContext._currentValue, JSCompiler_temp$jscomp$0 = JSCompiler_temp$jscomp$0.parent !== digest ? { parent: digest, pool: digest } : JSCompiler_temp$jscomp$0) : JSCompiler_temp$jscomp$0 = getSuspendedCache(), nextInstance = {
            baseLanes: nextInstance.baseLanes | renderLanes2,
            cachePool: JSCompiler_temp$jscomp$0
          }), showFallback.memoizedState = nextInstance, showFallback.childLanes = getRemainingWorkInPrimaryTree(
            current,
            JSCompiler_temp,
            renderLanes2
          ), workInProgress2.memoizedState = SUSPENDED_MARKER, nextProps;
        pushPrimaryTreeSuspenseHandler(workInProgress2);
        renderLanes2 = current.child;
        current = renderLanes2.sibling;
        renderLanes2 = createWorkInProgress(renderLanes2, {
          mode: "visible",
          children: nextProps.children
        });
        renderLanes2.return = workInProgress2;
        renderLanes2.sibling = null;
        null !== current && (JSCompiler_temp = workInProgress2.deletions, null === JSCompiler_temp ? (workInProgress2.deletions = [current], workInProgress2.flags |= 16) : JSCompiler_temp.push(current));
        workInProgress2.child = renderLanes2;
        workInProgress2.memoizedState = null;
        return renderLanes2;
      }
      function mountSuspensePrimaryChildren(workInProgress2, primaryChildren) {
        primaryChildren = mountWorkInProgressOffscreenFiber(
          { mode: "visible", children: primaryChildren },
          workInProgress2.mode
        );
        primaryChildren.return = workInProgress2;
        return workInProgress2.child = primaryChildren;
      }
      function mountWorkInProgressOffscreenFiber(offscreenProps, mode) {
        offscreenProps = createFiberImplClass(22, offscreenProps, null, mode);
        offscreenProps.lanes = 0;
        offscreenProps.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        };
        return offscreenProps;
      }
      function retrySuspenseComponentWithoutHydrating(current, workInProgress2, renderLanes2) {
        reconcileChildFibers(workInProgress2, current.child, null, renderLanes2);
        current = mountSuspensePrimaryChildren(
          workInProgress2,
          workInProgress2.pendingProps.children
        );
        current.flags |= 2;
        workInProgress2.memoizedState = null;
        return current;
      }
      function scheduleSuspenseWorkOnFiber(fiber, renderLanes2, propagationRoot) {
        fiber.lanes |= renderLanes2;
        var alternate = fiber.alternate;
        null !== alternate && (alternate.lanes |= renderLanes2);
        scheduleContextWorkOnParentPath(fiber.return, renderLanes2, propagationRoot);
      }
      function initSuspenseListRenderState(workInProgress2, isBackwards, tail, lastContentRow, tailMode) {
        var renderState = workInProgress2.memoizedState;
        null === renderState ? workInProgress2.memoizedState = {
          isBackwards,
          rendering: null,
          renderingStartTime: 0,
          last: lastContentRow,
          tail,
          tailMode
        } : (renderState.isBackwards = isBackwards, renderState.rendering = null, renderState.renderingStartTime = 0, renderState.last = lastContentRow, renderState.tail = tail, renderState.tailMode = tailMode);
      }
      function updateSuspenseListComponent(current, workInProgress2, renderLanes2) {
        var nextProps = workInProgress2.pendingProps, revealOrder = nextProps.revealOrder, tailMode = nextProps.tail;
        reconcileChildren(current, workInProgress2, nextProps.children, renderLanes2);
        nextProps = suspenseStackCursor.current;
        if (0 !== (nextProps & 2))
          nextProps = nextProps & 1 | 2, workInProgress2.flags |= 128;
        else {
          if (null !== current && 0 !== (current.flags & 128))
            a: for (current = workInProgress2.child; null !== current; ) {
              if (13 === current.tag)
                null !== current.memoizedState && scheduleSuspenseWorkOnFiber(current, renderLanes2, workInProgress2);
              else if (19 === current.tag)
                scheduleSuspenseWorkOnFiber(current, renderLanes2, workInProgress2);
              else if (null !== current.child) {
                current.child.return = current;
                current = current.child;
                continue;
              }
              if (current === workInProgress2) break a;
              for (; null === current.sibling; ) {
                if (null === current.return || current.return === workInProgress2)
                  break a;
                current = current.return;
              }
              current.sibling.return = current.return;
              current = current.sibling;
            }
          nextProps &= 1;
        }
        push(suspenseStackCursor, nextProps);
        switch (revealOrder) {
          case "forwards":
            renderLanes2 = workInProgress2.child;
            for (revealOrder = null; null !== renderLanes2; )
              current = renderLanes2.alternate, null !== current && null === findFirstSuspended(current) && (revealOrder = renderLanes2), renderLanes2 = renderLanes2.sibling;
            renderLanes2 = revealOrder;
            null === renderLanes2 ? (revealOrder = workInProgress2.child, workInProgress2.child = null) : (revealOrder = renderLanes2.sibling, renderLanes2.sibling = null);
            initSuspenseListRenderState(
              workInProgress2,
              false,
              revealOrder,
              renderLanes2,
              tailMode
            );
            break;
          case "backwards":
            renderLanes2 = null;
            revealOrder = workInProgress2.child;
            for (workInProgress2.child = null; null !== revealOrder; ) {
              current = revealOrder.alternate;
              if (null !== current && null === findFirstSuspended(current)) {
                workInProgress2.child = revealOrder;
                break;
              }
              current = revealOrder.sibling;
              revealOrder.sibling = renderLanes2;
              renderLanes2 = revealOrder;
              revealOrder = current;
            }
            initSuspenseListRenderState(
              workInProgress2,
              true,
              renderLanes2,
              null,
              tailMode
            );
            break;
          case "together":
            initSuspenseListRenderState(workInProgress2, false, null, null, void 0);
            break;
          default:
            workInProgress2.memoizedState = null;
        }
        return workInProgress2.child;
      }
      function bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2) {
        null !== current && (workInProgress2.dependencies = current.dependencies);
        workInProgressRootSkippedLanes |= workInProgress2.lanes;
        if (0 === (renderLanes2 & workInProgress2.childLanes))
          if (null !== current) {
            if (propagateParentContextChanges(
              current,
              workInProgress2,
              renderLanes2,
              false
            ), 0 === (renderLanes2 & workInProgress2.childLanes))
              return null;
          } else return null;
        if (null !== current && workInProgress2.child !== current.child)
          throw Error(formatProdErrorMessage(153));
        if (null !== workInProgress2.child) {
          current = workInProgress2.child;
          renderLanes2 = createWorkInProgress(current, current.pendingProps);
          workInProgress2.child = renderLanes2;
          for (renderLanes2.return = workInProgress2; null !== current.sibling; )
            current = current.sibling, renderLanes2 = renderLanes2.sibling = createWorkInProgress(current, current.pendingProps), renderLanes2.return = workInProgress2;
          renderLanes2.sibling = null;
        }
        return workInProgress2.child;
      }
      function checkScheduledUpdateOrContext(current, renderLanes2) {
        if (0 !== (current.lanes & renderLanes2)) return true;
        current = current.dependencies;
        return null !== current && checkIfContextChanged(current) ? true : false;
      }
      function attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress2, renderLanes2) {
        switch (workInProgress2.tag) {
          case 3:
            pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
            pushProvider(workInProgress2, CacheContext, current.memoizedState.cache);
            resetHydrationState();
            break;
          case 27:
          case 5:
            pushHostContext(workInProgress2);
            break;
          case 4:
            pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
            break;
          case 10:
            pushProvider(
              workInProgress2,
              workInProgress2.type,
              workInProgress2.memoizedProps.value
            );
            break;
          case 13:
            var state = workInProgress2.memoizedState;
            if (null !== state) {
              if (null !== state.dehydrated)
                return pushPrimaryTreeSuspenseHandler(workInProgress2), workInProgress2.flags |= 128, null;
              if (0 !== (renderLanes2 & workInProgress2.child.childLanes))
                return updateSuspenseComponent(current, workInProgress2, renderLanes2);
              pushPrimaryTreeSuspenseHandler(workInProgress2);
              current = bailoutOnAlreadyFinishedWork(
                current,
                workInProgress2,
                renderLanes2
              );
              return null !== current ? current.sibling : null;
            }
            pushPrimaryTreeSuspenseHandler(workInProgress2);
            break;
          case 19:
            var didSuspendBefore = 0 !== (current.flags & 128);
            state = 0 !== (renderLanes2 & workInProgress2.childLanes);
            state || (propagateParentContextChanges(
              current,
              workInProgress2,
              renderLanes2,
              false
            ), state = 0 !== (renderLanes2 & workInProgress2.childLanes));
            if (didSuspendBefore) {
              if (state)
                return updateSuspenseListComponent(
                  current,
                  workInProgress2,
                  renderLanes2
                );
              workInProgress2.flags |= 128;
            }
            didSuspendBefore = workInProgress2.memoizedState;
            null !== didSuspendBefore && (didSuspendBefore.rendering = null, didSuspendBefore.tail = null, didSuspendBefore.lastEffect = null);
            push(suspenseStackCursor, suspenseStackCursor.current);
            if (state) break;
            else return null;
          case 22:
          case 23:
            return workInProgress2.lanes = 0, updateOffscreenComponent(current, workInProgress2, renderLanes2);
          case 24:
            pushProvider(workInProgress2, CacheContext, current.memoizedState.cache);
        }
        return bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
      }
      function beginWork(current, workInProgress2, renderLanes2) {
        if (null !== current)
          if (current.memoizedProps !== workInProgress2.pendingProps)
            didReceiveUpdate = true;
          else {
            if (!checkScheduledUpdateOrContext(current, renderLanes2) && 0 === (workInProgress2.flags & 128))
              return didReceiveUpdate = false, attemptEarlyBailoutIfNoScheduledUpdate(
                current,
                workInProgress2,
                renderLanes2
              );
            didReceiveUpdate = 0 !== (current.flags & 131072) ? true : false;
          }
        else
          didReceiveUpdate = false, isHydrating && 0 !== (workInProgress2.flags & 1048576) && pushTreeId(workInProgress2, treeForkCount, workInProgress2.index);
        workInProgress2.lanes = 0;
        switch (workInProgress2.tag) {
          case 16:
            a: {
              current = workInProgress2.pendingProps;
              var lazyComponent = workInProgress2.elementType, init = lazyComponent._init;
              lazyComponent = init(lazyComponent._payload);
              workInProgress2.type = lazyComponent;
              if ("function" === typeof lazyComponent)
                shouldConstruct(lazyComponent) ? (current = resolveClassComponentProps(lazyComponent, current), workInProgress2.tag = 1, workInProgress2 = updateClassComponent(
                  null,
                  workInProgress2,
                  lazyComponent,
                  current,
                  renderLanes2
                )) : (workInProgress2.tag = 0, workInProgress2 = updateFunctionComponent(
                  null,
                  workInProgress2,
                  lazyComponent,
                  current,
                  renderLanes2
                ));
              else {
                if (void 0 !== lazyComponent && null !== lazyComponent) {
                  if (init = lazyComponent.$$typeof, init === REACT_FORWARD_REF_TYPE) {
                    workInProgress2.tag = 11;
                    workInProgress2 = updateForwardRef(
                      null,
                      workInProgress2,
                      lazyComponent,
                      current,
                      renderLanes2
                    );
                    break a;
                  } else if (init === REACT_MEMO_TYPE) {
                    workInProgress2.tag = 14;
                    workInProgress2 = updateMemoComponent(
                      null,
                      workInProgress2,
                      lazyComponent,
                      current,
                      renderLanes2
                    );
                    break a;
                  }
                }
                workInProgress2 = getComponentNameFromType(lazyComponent) || lazyComponent;
                throw Error(formatProdErrorMessage(306, workInProgress2, ""));
              }
            }
            return workInProgress2;
          case 0:
            return updateFunctionComponent(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 1:
            return lazyComponent = workInProgress2.type, init = resolveClassComponentProps(
              lazyComponent,
              workInProgress2.pendingProps
            ), updateClassComponent(
              current,
              workInProgress2,
              lazyComponent,
              init,
              renderLanes2
            );
          case 3:
            a: {
              pushHostContainer(
                workInProgress2,
                workInProgress2.stateNode.containerInfo
              );
              if (null === current) throw Error(formatProdErrorMessage(387));
              lazyComponent = workInProgress2.pendingProps;
              var prevState = workInProgress2.memoizedState;
              init = prevState.element;
              cloneUpdateQueue(current, workInProgress2);
              processUpdateQueue(workInProgress2, lazyComponent, null, renderLanes2);
              var nextState = workInProgress2.memoizedState;
              lazyComponent = nextState.cache;
              pushProvider(workInProgress2, CacheContext, lazyComponent);
              lazyComponent !== prevState.cache && propagateContextChanges(
                workInProgress2,
                [CacheContext],
                renderLanes2,
                true
              );
              suspendIfUpdateReadFromEntangledAsyncAction();
              lazyComponent = nextState.element;
              if (prevState.isDehydrated)
                if (prevState = {
                  element: lazyComponent,
                  isDehydrated: false,
                  cache: nextState.cache
                }, workInProgress2.updateQueue.baseState = prevState, workInProgress2.memoizedState = prevState, workInProgress2.flags & 256) {
                  workInProgress2 = mountHostRootWithoutHydrating(
                    current,
                    workInProgress2,
                    lazyComponent,
                    renderLanes2
                  );
                  break a;
                } else if (lazyComponent !== init) {
                  init = createCapturedValueAtFiber(
                    Error(formatProdErrorMessage(424)),
                    workInProgress2
                  );
                  queueHydrationError(init);
                  workInProgress2 = mountHostRootWithoutHydrating(
                    current,
                    workInProgress2,
                    lazyComponent,
                    renderLanes2
                  );
                  break a;
                } else {
                  current = workInProgress2.stateNode.containerInfo;
                  switch (current.nodeType) {
                    case 9:
                      current = current.body;
                      break;
                    default:
                      current = "HTML" === current.nodeName ? current.ownerDocument.body : current;
                  }
                  nextHydratableInstance = getNextHydratable(current.firstChild);
                  hydrationParentFiber = workInProgress2;
                  isHydrating = true;
                  hydrationErrors = null;
                  rootOrSingletonContext = true;
                  renderLanes2 = mountChildFibers(
                    workInProgress2,
                    null,
                    lazyComponent,
                    renderLanes2
                  );
                  for (workInProgress2.child = renderLanes2; renderLanes2; )
                    renderLanes2.flags = renderLanes2.flags & -3 | 4096, renderLanes2 = renderLanes2.sibling;
                }
              else {
                resetHydrationState();
                if (lazyComponent === init) {
                  workInProgress2 = bailoutOnAlreadyFinishedWork(
                    current,
                    workInProgress2,
                    renderLanes2
                  );
                  break a;
                }
                reconcileChildren(
                  current,
                  workInProgress2,
                  lazyComponent,
                  renderLanes2
                );
              }
              workInProgress2 = workInProgress2.child;
            }
            return workInProgress2;
          case 26:
            return markRef(current, workInProgress2), null === current ? (renderLanes2 = getResource(
              workInProgress2.type,
              null,
              workInProgress2.pendingProps,
              null
            )) ? workInProgress2.memoizedState = renderLanes2 : isHydrating || (renderLanes2 = workInProgress2.type, current = workInProgress2.pendingProps, lazyComponent = getOwnerDocumentFromRootContainer(
              rootInstanceStackCursor.current
            ).createElement(renderLanes2), lazyComponent[internalInstanceKey] = workInProgress2, lazyComponent[internalPropsKey] = current, setInitialProperties(lazyComponent, renderLanes2, current), markNodeAsHoistable(lazyComponent), workInProgress2.stateNode = lazyComponent) : workInProgress2.memoizedState = getResource(
              workInProgress2.type,
              current.memoizedProps,
              workInProgress2.pendingProps,
              current.memoizedState
            ), null;
          case 27:
            return pushHostContext(workInProgress2), null === current && isHydrating && (lazyComponent = workInProgress2.stateNode = resolveSingletonInstance(
              workInProgress2.type,
              workInProgress2.pendingProps,
              rootInstanceStackCursor.current
            ), hydrationParentFiber = workInProgress2, rootOrSingletonContext = true, init = nextHydratableInstance, isSingletonScope(workInProgress2.type) ? (previousHydratableOnEnteringScopedSingleton = init, nextHydratableInstance = getNextHydratable(
              lazyComponent.firstChild
            )) : nextHydratableInstance = init), reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps.children,
              renderLanes2
            ), markRef(current, workInProgress2), null === current && (workInProgress2.flags |= 4194304), workInProgress2.child;
          case 5:
            if (null === current && isHydrating) {
              if (init = lazyComponent = nextHydratableInstance)
                lazyComponent = canHydrateInstance(
                  lazyComponent,
                  workInProgress2.type,
                  workInProgress2.pendingProps,
                  rootOrSingletonContext
                ), null !== lazyComponent ? (workInProgress2.stateNode = lazyComponent, hydrationParentFiber = workInProgress2, nextHydratableInstance = getNextHydratable(
                  lazyComponent.firstChild
                ), rootOrSingletonContext = false, init = true) : init = false;
              init || throwOnHydrationMismatch(workInProgress2);
            }
            pushHostContext(workInProgress2);
            init = workInProgress2.type;
            prevState = workInProgress2.pendingProps;
            nextState = null !== current ? current.memoizedProps : null;
            lazyComponent = prevState.children;
            shouldSetTextContent(init, prevState) ? lazyComponent = null : null !== nextState && shouldSetTextContent(init, nextState) && (workInProgress2.flags |= 32);
            null !== workInProgress2.memoizedState && (init = renderWithHooks(
              current,
              workInProgress2,
              TransitionAwareHostComponent,
              null,
              null,
              renderLanes2
            ), HostTransitionContext._currentValue = init);
            markRef(current, workInProgress2);
            reconcileChildren(current, workInProgress2, lazyComponent, renderLanes2);
            return workInProgress2.child;
          case 6:
            if (null === current && isHydrating) {
              if (current = renderLanes2 = nextHydratableInstance)
                renderLanes2 = canHydrateTextInstance(
                  renderLanes2,
                  workInProgress2.pendingProps,
                  rootOrSingletonContext
                ), null !== renderLanes2 ? (workInProgress2.stateNode = renderLanes2, hydrationParentFiber = workInProgress2, nextHydratableInstance = null, current = true) : current = false;
              current || throwOnHydrationMismatch(workInProgress2);
            }
            return null;
          case 13:
            return updateSuspenseComponent(current, workInProgress2, renderLanes2);
          case 4:
            return pushHostContainer(
              workInProgress2,
              workInProgress2.stateNode.containerInfo
            ), lazyComponent = workInProgress2.pendingProps, null === current ? workInProgress2.child = reconcileChildFibers(
              workInProgress2,
              null,
              lazyComponent,
              renderLanes2
            ) : reconcileChildren(
              current,
              workInProgress2,
              lazyComponent,
              renderLanes2
            ), workInProgress2.child;
          case 11:
            return updateForwardRef(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 7:
            return reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps,
              renderLanes2
            ), workInProgress2.child;
          case 8:
            return reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps.children,
              renderLanes2
            ), workInProgress2.child;
          case 12:
            return reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps.children,
              renderLanes2
            ), workInProgress2.child;
          case 10:
            return lazyComponent = workInProgress2.pendingProps, pushProvider(workInProgress2, workInProgress2.type, lazyComponent.value), reconcileChildren(
              current,
              workInProgress2,
              lazyComponent.children,
              renderLanes2
            ), workInProgress2.child;
          case 9:
            return init = workInProgress2.type._context, lazyComponent = workInProgress2.pendingProps.children, prepareToReadContext(workInProgress2), init = readContext(init), lazyComponent = lazyComponent(init), workInProgress2.flags |= 1, reconcileChildren(current, workInProgress2, lazyComponent, renderLanes2), workInProgress2.child;
          case 14:
            return updateMemoComponent(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 15:
            return updateSimpleMemoComponent(
              current,
              workInProgress2,
              workInProgress2.type,
              workInProgress2.pendingProps,
              renderLanes2
            );
          case 19:
            return updateSuspenseListComponent(current, workInProgress2, renderLanes2);
          case 31:
            return lazyComponent = workInProgress2.pendingProps, renderLanes2 = workInProgress2.mode, lazyComponent = {
              mode: lazyComponent.mode,
              children: lazyComponent.children
            }, null === current ? (renderLanes2 = mountWorkInProgressOffscreenFiber(
              lazyComponent,
              renderLanes2
            ), renderLanes2.ref = workInProgress2.ref, workInProgress2.child = renderLanes2, renderLanes2.return = workInProgress2, workInProgress2 = renderLanes2) : (renderLanes2 = createWorkInProgress(current.child, lazyComponent), renderLanes2.ref = workInProgress2.ref, workInProgress2.child = renderLanes2, renderLanes2.return = workInProgress2, workInProgress2 = renderLanes2), workInProgress2;
          case 22:
            return updateOffscreenComponent(current, workInProgress2, renderLanes2);
          case 24:
            return prepareToReadContext(workInProgress2), lazyComponent = readContext(CacheContext), null === current ? (init = peekCacheFromPool(), null === init && (init = workInProgressRoot, prevState = createCache(), init.pooledCache = prevState, prevState.refCount++, null !== prevState && (init.pooledCacheLanes |= renderLanes2), init = prevState), workInProgress2.memoizedState = {
              parent: lazyComponent,
              cache: init
            }, initializeUpdateQueue(workInProgress2), pushProvider(workInProgress2, CacheContext, init)) : (0 !== (current.lanes & renderLanes2) && (cloneUpdateQueue(current, workInProgress2), processUpdateQueue(workInProgress2, null, null, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction()), init = current.memoizedState, prevState = workInProgress2.memoizedState, init.parent !== lazyComponent ? (init = { parent: lazyComponent, cache: lazyComponent }, workInProgress2.memoizedState = init, 0 === workInProgress2.lanes && (workInProgress2.memoizedState = workInProgress2.updateQueue.baseState = init), pushProvider(workInProgress2, CacheContext, lazyComponent)) : (lazyComponent = prevState.cache, pushProvider(workInProgress2, CacheContext, lazyComponent), lazyComponent !== init.cache && propagateContextChanges(
              workInProgress2,
              [CacheContext],
              renderLanes2,
              true
            ))), reconcileChildren(
              current,
              workInProgress2,
              workInProgress2.pendingProps.children,
              renderLanes2
            ), workInProgress2.child;
          case 29:
            throw workInProgress2.pendingProps;
        }
        throw Error(formatProdErrorMessage(156, workInProgress2.tag));
      }
      function markUpdate(workInProgress2) {
        workInProgress2.flags |= 4;
      }
      function preloadResourceAndSuspendIfNeeded(workInProgress2, resource) {
        if ("stylesheet" !== resource.type || 0 !== (resource.state.loading & 4))
          workInProgress2.flags &= -16777217;
        else if (workInProgress2.flags |= 16777216, !preloadResource(resource)) {
          resource = suspenseHandlerStackCursor.current;
          if (null !== resource && ((workInProgressRootRenderLanes & 4194048) === workInProgressRootRenderLanes ? null !== shellBoundary : (workInProgressRootRenderLanes & 62914560) !== workInProgressRootRenderLanes && 0 === (workInProgressRootRenderLanes & 536870912) || resource !== shellBoundary))
            throw suspendedThenable = noopSuspenseyCommitThenable, SuspenseyCommitException;
          workInProgress2.flags |= 8192;
        }
      }
      function scheduleRetryEffect(workInProgress2, retryQueue) {
        null !== retryQueue && (workInProgress2.flags |= 4);
        workInProgress2.flags & 16384 && (retryQueue = 22 !== workInProgress2.tag ? claimNextRetryLane() : 536870912, workInProgress2.lanes |= retryQueue, workInProgressSuspendedRetryLanes |= retryQueue);
      }
      function cutOffTailIfNeeded(renderState, hasRenderedATailFallback) {
        if (!isHydrating)
          switch (renderState.tailMode) {
            case "hidden":
              hasRenderedATailFallback = renderState.tail;
              for (var lastTailNode = null; null !== hasRenderedATailFallback; )
                null !== hasRenderedATailFallback.alternate && (lastTailNode = hasRenderedATailFallback), hasRenderedATailFallback = hasRenderedATailFallback.sibling;
              null === lastTailNode ? renderState.tail = null : lastTailNode.sibling = null;
              break;
            case "collapsed":
              lastTailNode = renderState.tail;
              for (var lastTailNode$113 = null; null !== lastTailNode; )
                null !== lastTailNode.alternate && (lastTailNode$113 = lastTailNode), lastTailNode = lastTailNode.sibling;
              null === lastTailNode$113 ? hasRenderedATailFallback || null === renderState.tail ? renderState.tail = null : renderState.tail.sibling = null : lastTailNode$113.sibling = null;
          }
      }
      function bubbleProperties(completedWork) {
        var didBailout = null !== completedWork.alternate && completedWork.alternate.child === completedWork.child, newChildLanes = 0, subtreeFlags = 0;
        if (didBailout)
          for (var child$114 = completedWork.child; null !== child$114; )
            newChildLanes |= child$114.lanes | child$114.childLanes, subtreeFlags |= child$114.subtreeFlags & 65011712, subtreeFlags |= child$114.flags & 65011712, child$114.return = completedWork, child$114 = child$114.sibling;
        else
          for (child$114 = completedWork.child; null !== child$114; )
            newChildLanes |= child$114.lanes | child$114.childLanes, subtreeFlags |= child$114.subtreeFlags, subtreeFlags |= child$114.flags, child$114.return = completedWork, child$114 = child$114.sibling;
        completedWork.subtreeFlags |= subtreeFlags;
        completedWork.childLanes = newChildLanes;
        return didBailout;
      }
      function completeWork(current, workInProgress2, renderLanes2) {
        var newProps = workInProgress2.pendingProps;
        popTreeContext(workInProgress2);
        switch (workInProgress2.tag) {
          case 31:
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return bubbleProperties(workInProgress2), null;
          case 1:
            return bubbleProperties(workInProgress2), null;
          case 3:
            renderLanes2 = workInProgress2.stateNode;
            newProps = null;
            null !== current && (newProps = current.memoizedState.cache);
            workInProgress2.memoizedState.cache !== newProps && (workInProgress2.flags |= 2048);
            popProvider(CacheContext);
            popHostContainer();
            renderLanes2.pendingContext && (renderLanes2.context = renderLanes2.pendingContext, renderLanes2.pendingContext = null);
            if (null === current || null === current.child)
              popHydrationState(workInProgress2) ? markUpdate(workInProgress2) : null === current || current.memoizedState.isDehydrated && 0 === (workInProgress2.flags & 256) || (workInProgress2.flags |= 1024, upgradeHydrationErrorsToRecoverable());
            bubbleProperties(workInProgress2);
            return null;
          case 26:
            return renderLanes2 = workInProgress2.memoizedState, null === current ? (markUpdate(workInProgress2), null !== renderLanes2 ? (bubbleProperties(workInProgress2), preloadResourceAndSuspendIfNeeded(workInProgress2, renderLanes2)) : (bubbleProperties(workInProgress2), workInProgress2.flags &= -16777217)) : renderLanes2 ? renderLanes2 !== current.memoizedState ? (markUpdate(workInProgress2), bubbleProperties(workInProgress2), preloadResourceAndSuspendIfNeeded(workInProgress2, renderLanes2)) : (bubbleProperties(workInProgress2), workInProgress2.flags &= -16777217) : (current.memoizedProps !== newProps && markUpdate(workInProgress2), bubbleProperties(workInProgress2), workInProgress2.flags &= -16777217), null;
          case 27:
            popHostContext(workInProgress2);
            renderLanes2 = rootInstanceStackCursor.current;
            var type = workInProgress2.type;
            if (null !== current && null != workInProgress2.stateNode)
              current.memoizedProps !== newProps && markUpdate(workInProgress2);
            else {
              if (!newProps) {
                if (null === workInProgress2.stateNode)
                  throw Error(formatProdErrorMessage(166));
                bubbleProperties(workInProgress2);
                return null;
              }
              current = contextStackCursor.current;
              popHydrationState(workInProgress2) ? prepareToHydrateHostInstance(workInProgress2, current) : (current = resolveSingletonInstance(type, newProps, renderLanes2), workInProgress2.stateNode = current, markUpdate(workInProgress2));
            }
            bubbleProperties(workInProgress2);
            return null;
          case 5:
            popHostContext(workInProgress2);
            renderLanes2 = workInProgress2.type;
            if (null !== current && null != workInProgress2.stateNode)
              current.memoizedProps !== newProps && markUpdate(workInProgress2);
            else {
              if (!newProps) {
                if (null === workInProgress2.stateNode)
                  throw Error(formatProdErrorMessage(166));
                bubbleProperties(workInProgress2);
                return null;
              }
              current = contextStackCursor.current;
              if (popHydrationState(workInProgress2))
                prepareToHydrateHostInstance(workInProgress2, current);
              else {
                type = getOwnerDocumentFromRootContainer(
                  rootInstanceStackCursor.current
                );
                switch (current) {
                  case 1:
                    current = type.createElementNS(
                      "http://www.w3.org/2000/svg",
                      renderLanes2
                    );
                    break;
                  case 2:
                    current = type.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      renderLanes2
                    );
                    break;
                  default:
                    switch (renderLanes2) {
                      case "svg":
                        current = type.createElementNS(
                          "http://www.w3.org/2000/svg",
                          renderLanes2
                        );
                        break;
                      case "math":
                        current = type.createElementNS(
                          "http://www.w3.org/1998/Math/MathML",
                          renderLanes2
                        );
                        break;
                      case "script":
                        current = type.createElement("div");
                        current.innerHTML = "<script><\/script>";
                        current = current.removeChild(current.firstChild);
                        break;
                      case "select":
                        current = "string" === typeof newProps.is ? type.createElement("select", { is: newProps.is }) : type.createElement("select");
                        newProps.multiple ? current.multiple = true : newProps.size && (current.size = newProps.size);
                        break;
                      default:
                        current = "string" === typeof newProps.is ? type.createElement(renderLanes2, { is: newProps.is }) : type.createElement(renderLanes2);
                    }
                }
                current[internalInstanceKey] = workInProgress2;
                current[internalPropsKey] = newProps;
                a: for (type = workInProgress2.child; null !== type; ) {
                  if (5 === type.tag || 6 === type.tag)
                    current.appendChild(type.stateNode);
                  else if (4 !== type.tag && 27 !== type.tag && null !== type.child) {
                    type.child.return = type;
                    type = type.child;
                    continue;
                  }
                  if (type === workInProgress2) break a;
                  for (; null === type.sibling; ) {
                    if (null === type.return || type.return === workInProgress2)
                      break a;
                    type = type.return;
                  }
                  type.sibling.return = type.return;
                  type = type.sibling;
                }
                workInProgress2.stateNode = current;
                a: switch (setInitialProperties(current, renderLanes2, newProps), renderLanes2) {
                  case "button":
                  case "input":
                  case "select":
                  case "textarea":
                    current = !!newProps.autoFocus;
                    break a;
                  case "img":
                    current = true;
                    break a;
                  default:
                    current = false;
                }
                current && markUpdate(workInProgress2);
              }
            }
            bubbleProperties(workInProgress2);
            workInProgress2.flags &= -16777217;
            return null;
          case 6:
            if (current && null != workInProgress2.stateNode)
              current.memoizedProps !== newProps && markUpdate(workInProgress2);
            else {
              if ("string" !== typeof newProps && null === workInProgress2.stateNode)
                throw Error(formatProdErrorMessage(166));
              current = rootInstanceStackCursor.current;
              if (popHydrationState(workInProgress2)) {
                current = workInProgress2.stateNode;
                renderLanes2 = workInProgress2.memoizedProps;
                newProps = null;
                type = hydrationParentFiber;
                if (null !== type)
                  switch (type.tag) {
                    case 27:
                    case 5:
                      newProps = type.memoizedProps;
                  }
                current[internalInstanceKey] = workInProgress2;
                current = current.nodeValue === renderLanes2 || null !== newProps && true === newProps.suppressHydrationWarning || checkForUnmatchedText(current.nodeValue, renderLanes2) ? true : false;
                current || throwOnHydrationMismatch(workInProgress2);
              } else
                current = getOwnerDocumentFromRootContainer(current).createTextNode(
                  newProps
                ), current[internalInstanceKey] = workInProgress2, workInProgress2.stateNode = current;
            }
            bubbleProperties(workInProgress2);
            return null;
          case 13:
            newProps = workInProgress2.memoizedState;
            if (null === current || null !== current.memoizedState && null !== current.memoizedState.dehydrated) {
              type = popHydrationState(workInProgress2);
              if (null !== newProps && null !== newProps.dehydrated) {
                if (null === current) {
                  if (!type) throw Error(formatProdErrorMessage(318));
                  type = workInProgress2.memoizedState;
                  type = null !== type ? type.dehydrated : null;
                  if (!type) throw Error(formatProdErrorMessage(317));
                  type[internalInstanceKey] = workInProgress2;
                } else
                  resetHydrationState(), 0 === (workInProgress2.flags & 128) && (workInProgress2.memoizedState = null), workInProgress2.flags |= 4;
                bubbleProperties(workInProgress2);
                type = false;
              } else
                type = upgradeHydrationErrorsToRecoverable(), null !== current && null !== current.memoizedState && (current.memoizedState.hydrationErrors = type), type = true;
              if (!type) {
                if (workInProgress2.flags & 256)
                  return popSuspenseHandler(workInProgress2), workInProgress2;
                popSuspenseHandler(workInProgress2);
                return null;
              }
            }
            popSuspenseHandler(workInProgress2);
            if (0 !== (workInProgress2.flags & 128))
              return workInProgress2.lanes = renderLanes2, workInProgress2;
            renderLanes2 = null !== newProps;
            current = null !== current && null !== current.memoizedState;
            if (renderLanes2) {
              newProps = workInProgress2.child;
              type = null;
              null !== newProps.alternate && null !== newProps.alternate.memoizedState && null !== newProps.alternate.memoizedState.cachePool && (type = newProps.alternate.memoizedState.cachePool.pool);
              var cache$127 = null;
              null !== newProps.memoizedState && null !== newProps.memoizedState.cachePool && (cache$127 = newProps.memoizedState.cachePool.pool);
              cache$127 !== type && (newProps.flags |= 2048);
            }
            renderLanes2 !== current && renderLanes2 && (workInProgress2.child.flags |= 8192);
            scheduleRetryEffect(workInProgress2, workInProgress2.updateQueue);
            bubbleProperties(workInProgress2);
            return null;
          case 4:
            return popHostContainer(), null === current && listenToAllSupportedEvents(workInProgress2.stateNode.containerInfo), bubbleProperties(workInProgress2), null;
          case 10:
            return popProvider(workInProgress2.type), bubbleProperties(workInProgress2), null;
          case 19:
            pop(suspenseStackCursor);
            type = workInProgress2.memoizedState;
            if (null === type) return bubbleProperties(workInProgress2), null;
            newProps = 0 !== (workInProgress2.flags & 128);
            cache$127 = type.rendering;
            if (null === cache$127)
              if (newProps) cutOffTailIfNeeded(type, false);
              else {
                if (0 !== workInProgressRootExitStatus || null !== current && 0 !== (current.flags & 128))
                  for (current = workInProgress2.child; null !== current; ) {
                    cache$127 = findFirstSuspended(current);
                    if (null !== cache$127) {
                      workInProgress2.flags |= 128;
                      cutOffTailIfNeeded(type, false);
                      current = cache$127.updateQueue;
                      workInProgress2.updateQueue = current;
                      scheduleRetryEffect(workInProgress2, current);
                      workInProgress2.subtreeFlags = 0;
                      current = renderLanes2;
                      for (renderLanes2 = workInProgress2.child; null !== renderLanes2; )
                        resetWorkInProgress(renderLanes2, current), renderLanes2 = renderLanes2.sibling;
                      push(
                        suspenseStackCursor,
                        suspenseStackCursor.current & 1 | 2
                      );
                      return workInProgress2.child;
                    }
                    current = current.sibling;
                  }
                null !== type.tail && now() > workInProgressRootRenderTargetTime && (workInProgress2.flags |= 128, newProps = true, cutOffTailIfNeeded(type, false), workInProgress2.lanes = 4194304);
              }
            else {
              if (!newProps)
                if (current = findFirstSuspended(cache$127), null !== current) {
                  if (workInProgress2.flags |= 128, newProps = true, current = current.updateQueue, workInProgress2.updateQueue = current, scheduleRetryEffect(workInProgress2, current), cutOffTailIfNeeded(type, true), null === type.tail && "hidden" === type.tailMode && !cache$127.alternate && !isHydrating)
                    return bubbleProperties(workInProgress2), null;
                } else
                  2 * now() - type.renderingStartTime > workInProgressRootRenderTargetTime && 536870912 !== renderLanes2 && (workInProgress2.flags |= 128, newProps = true, cutOffTailIfNeeded(type, false), workInProgress2.lanes = 4194304);
              type.isBackwards ? (cache$127.sibling = workInProgress2.child, workInProgress2.child = cache$127) : (current = type.last, null !== current ? current.sibling = cache$127 : workInProgress2.child = cache$127, type.last = cache$127);
            }
            if (null !== type.tail)
              return workInProgress2 = type.tail, type.rendering = workInProgress2, type.tail = workInProgress2.sibling, type.renderingStartTime = now(), workInProgress2.sibling = null, current = suspenseStackCursor.current, push(suspenseStackCursor, newProps ? current & 1 | 2 : current & 1), workInProgress2;
            bubbleProperties(workInProgress2);
            return null;
          case 22:
          case 23:
            return popSuspenseHandler(workInProgress2), popHiddenContext(), newProps = null !== workInProgress2.memoizedState, null !== current ? null !== current.memoizedState !== newProps && (workInProgress2.flags |= 8192) : newProps && (workInProgress2.flags |= 8192), newProps ? 0 !== (renderLanes2 & 536870912) && 0 === (workInProgress2.flags & 128) && (bubbleProperties(workInProgress2), workInProgress2.subtreeFlags & 6 && (workInProgress2.flags |= 8192)) : bubbleProperties(workInProgress2), renderLanes2 = workInProgress2.updateQueue, null !== renderLanes2 && scheduleRetryEffect(workInProgress2, renderLanes2.retryQueue), renderLanes2 = null, null !== current && null !== current.memoizedState && null !== current.memoizedState.cachePool && (renderLanes2 = current.memoizedState.cachePool.pool), newProps = null, null !== workInProgress2.memoizedState && null !== workInProgress2.memoizedState.cachePool && (newProps = workInProgress2.memoizedState.cachePool.pool), newProps !== renderLanes2 && (workInProgress2.flags |= 2048), null !== current && pop(resumedCache), null;
          case 24:
            return renderLanes2 = null, null !== current && (renderLanes2 = current.memoizedState.cache), workInProgress2.memoizedState.cache !== renderLanes2 && (workInProgress2.flags |= 2048), popProvider(CacheContext), bubbleProperties(workInProgress2), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(formatProdErrorMessage(156, workInProgress2.tag));
      }
      function unwindWork(current, workInProgress2) {
        popTreeContext(workInProgress2);
        switch (workInProgress2.tag) {
          case 1:
            return current = workInProgress2.flags, current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 3:
            return popProvider(CacheContext), popHostContainer(), current = workInProgress2.flags, 0 !== (current & 65536) && 0 === (current & 128) ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 26:
          case 27:
          case 5:
            return popHostContext(workInProgress2), null;
          case 13:
            popSuspenseHandler(workInProgress2);
            current = workInProgress2.memoizedState;
            if (null !== current && null !== current.dehydrated) {
              if (null === workInProgress2.alternate)
                throw Error(formatProdErrorMessage(340));
              resetHydrationState();
            }
            current = workInProgress2.flags;
            return current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 19:
            return pop(suspenseStackCursor), null;
          case 4:
            return popHostContainer(), null;
          case 10:
            return popProvider(workInProgress2.type), null;
          case 22:
          case 23:
            return popSuspenseHandler(workInProgress2), popHiddenContext(), null !== current && pop(resumedCache), current = workInProgress2.flags, current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
          case 24:
            return popProvider(CacheContext), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function unwindInterruptedWork(current, interruptedWork) {
        popTreeContext(interruptedWork);
        switch (interruptedWork.tag) {
          case 3:
            popProvider(CacheContext);
            popHostContainer();
            break;
          case 26:
          case 27:
          case 5:
            popHostContext(interruptedWork);
            break;
          case 4:
            popHostContainer();
            break;
          case 13:
            popSuspenseHandler(interruptedWork);
            break;
          case 19:
            pop(suspenseStackCursor);
            break;
          case 10:
            popProvider(interruptedWork.type);
            break;
          case 22:
          case 23:
            popSuspenseHandler(interruptedWork);
            popHiddenContext();
            null !== current && pop(resumedCache);
            break;
          case 24:
            popProvider(CacheContext);
        }
      }
      function commitHookEffectListMount(flags, finishedWork) {
        try {
          var updateQueue = finishedWork.updateQueue, lastEffect = null !== updateQueue ? updateQueue.lastEffect : null;
          if (null !== lastEffect) {
            var firstEffect = lastEffect.next;
            updateQueue = firstEffect;
            do {
              if ((updateQueue.tag & flags) === flags) {
                lastEffect = void 0;
                var create2 = updateQueue.create, inst = updateQueue.inst;
                lastEffect = create2();
                inst.destroy = lastEffect;
              }
              updateQueue = updateQueue.next;
            } while (updateQueue !== firstEffect);
          }
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function commitHookEffectListUnmount(flags, finishedWork, nearestMountedAncestor$jscomp$0) {
        try {
          var updateQueue = finishedWork.updateQueue, lastEffect = null !== updateQueue ? updateQueue.lastEffect : null;
          if (null !== lastEffect) {
            var firstEffect = lastEffect.next;
            updateQueue = firstEffect;
            do {
              if ((updateQueue.tag & flags) === flags) {
                var inst = updateQueue.inst, destroy = inst.destroy;
                if (void 0 !== destroy) {
                  inst.destroy = void 0;
                  lastEffect = finishedWork;
                  var nearestMountedAncestor = nearestMountedAncestor$jscomp$0, destroy_ = destroy;
                  try {
                    destroy_();
                  } catch (error) {
                    captureCommitPhaseError(
                      lastEffect,
                      nearestMountedAncestor,
                      error
                    );
                  }
                }
              }
              updateQueue = updateQueue.next;
            } while (updateQueue !== firstEffect);
          }
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function commitClassCallbacks(finishedWork) {
        var updateQueue = finishedWork.updateQueue;
        if (null !== updateQueue) {
          var instance = finishedWork.stateNode;
          try {
            commitCallbacks(updateQueue, instance);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      }
      function safelyCallComponentWillUnmount(current, nearestMountedAncestor, instance) {
        instance.props = resolveClassComponentProps(
          current.type,
          current.memoizedProps
        );
        instance.state = current.memoizedState;
        try {
          instance.componentWillUnmount();
        } catch (error) {
          captureCommitPhaseError(current, nearestMountedAncestor, error);
        }
      }
      function safelyAttachRef(current, nearestMountedAncestor) {
        try {
          var ref = current.ref;
          if (null !== ref) {
            switch (current.tag) {
              case 26:
              case 27:
              case 5:
                var instanceToUse = current.stateNode;
                break;
              case 30:
                instanceToUse = current.stateNode;
                break;
              default:
                instanceToUse = current.stateNode;
            }
            "function" === typeof ref ? current.refCleanup = ref(instanceToUse) : ref.current = instanceToUse;
          }
        } catch (error) {
          captureCommitPhaseError(current, nearestMountedAncestor, error);
        }
      }
      function safelyDetachRef(current, nearestMountedAncestor) {
        var ref = current.ref, refCleanup = current.refCleanup;
        if (null !== ref)
          if ("function" === typeof refCleanup)
            try {
              refCleanup();
            } catch (error) {
              captureCommitPhaseError(current, nearestMountedAncestor, error);
            } finally {
              current.refCleanup = null, current = current.alternate, null != current && (current.refCleanup = null);
            }
          else if ("function" === typeof ref)
            try {
              ref(null);
            } catch (error$143) {
              captureCommitPhaseError(current, nearestMountedAncestor, error$143);
            }
          else ref.current = null;
      }
      function commitHostMount(finishedWork) {
        var type = finishedWork.type, props = finishedWork.memoizedProps, instance = finishedWork.stateNode;
        try {
          a: switch (type) {
            case "button":
            case "input":
            case "select":
            case "textarea":
              props.autoFocus && instance.focus();
              break a;
            case "img":
              props.src ? instance.src = props.src : props.srcSet && (instance.srcset = props.srcSet);
          }
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function commitHostUpdate(finishedWork, newProps, oldProps) {
        try {
          var domElement = finishedWork.stateNode;
          updateProperties(domElement, finishedWork.type, oldProps, newProps);
          domElement[internalPropsKey] = newProps;
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      function isHostParent(fiber) {
        return 5 === fiber.tag || 3 === fiber.tag || 26 === fiber.tag || 27 === fiber.tag && isSingletonScope(fiber.type) || 4 === fiber.tag;
      }
      function getHostSibling(fiber) {
        a: for (; ; ) {
          for (; null === fiber.sibling; ) {
            if (null === fiber.return || isHostParent(fiber.return)) return null;
            fiber = fiber.return;
          }
          fiber.sibling.return = fiber.return;
          for (fiber = fiber.sibling; 5 !== fiber.tag && 6 !== fiber.tag && 18 !== fiber.tag; ) {
            if (27 === fiber.tag && isSingletonScope(fiber.type)) continue a;
            if (fiber.flags & 2) continue a;
            if (null === fiber.child || 4 === fiber.tag) continue a;
            else fiber.child.return = fiber, fiber = fiber.child;
          }
          if (!(fiber.flags & 2)) return fiber.stateNode;
        }
      }
      function insertOrAppendPlacementNodeIntoContainer(node, before, parent) {
        var tag = node.tag;
        if (5 === tag || 6 === tag)
          node = node.stateNode, before ? (9 === parent.nodeType ? parent.body : "HTML" === parent.nodeName ? parent.ownerDocument.body : parent).insertBefore(node, before) : (before = 9 === parent.nodeType ? parent.body : "HTML" === parent.nodeName ? parent.ownerDocument.body : parent, before.appendChild(node), parent = parent._reactRootContainer, null !== parent && void 0 !== parent || null !== before.onclick || (before.onclick = noop$1));
        else if (4 !== tag && (27 === tag && isSingletonScope(node.type) && (parent = node.stateNode, before = null), node = node.child, null !== node))
          for (insertOrAppendPlacementNodeIntoContainer(node, before, parent), node = node.sibling; null !== node; )
            insertOrAppendPlacementNodeIntoContainer(node, before, parent), node = node.sibling;
      }
      function insertOrAppendPlacementNode(node, before, parent) {
        var tag = node.tag;
        if (5 === tag || 6 === tag)
          node = node.stateNode, before ? parent.insertBefore(node, before) : parent.appendChild(node);
        else if (4 !== tag && (27 === tag && isSingletonScope(node.type) && (parent = node.stateNode), node = node.child, null !== node))
          for (insertOrAppendPlacementNode(node, before, parent), node = node.sibling; null !== node; )
            insertOrAppendPlacementNode(node, before, parent), node = node.sibling;
      }
      function commitHostSingletonAcquisition(finishedWork) {
        var singleton = finishedWork.stateNode, props = finishedWork.memoizedProps;
        try {
          for (var type = finishedWork.type, attributes = singleton.attributes; attributes.length; )
            singleton.removeAttributeNode(attributes[0]);
          setInitialProperties(singleton, type, props);
          singleton[internalInstanceKey] = finishedWork;
          singleton[internalPropsKey] = props;
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      var offscreenSubtreeIsHidden = false;
      var offscreenSubtreeWasHidden = false;
      var needsFormReset = false;
      var PossiblyWeakSet = "function" === typeof WeakSet ? WeakSet : Set;
      var nextEffect = null;
      function commitBeforeMutationEffects(root2, firstChild) {
        root2 = root2.containerInfo;
        eventsEnabled = _enabled;
        root2 = getActiveElementDeep(root2);
        if (hasSelectionCapabilities(root2)) {
          if ("selectionStart" in root2)
            var JSCompiler_temp = {
              start: root2.selectionStart,
              end: root2.selectionEnd
            };
          else
            a: {
              JSCompiler_temp = (JSCompiler_temp = root2.ownerDocument) && JSCompiler_temp.defaultView || window;
              var selection = JSCompiler_temp.getSelection && JSCompiler_temp.getSelection();
              if (selection && 0 !== selection.rangeCount) {
                JSCompiler_temp = selection.anchorNode;
                var anchorOffset = selection.anchorOffset, focusNode = selection.focusNode;
                selection = selection.focusOffset;
                try {
                  JSCompiler_temp.nodeType, focusNode.nodeType;
                } catch (e$20) {
                  JSCompiler_temp = null;
                  break a;
                }
                var length = 0, start = -1, end = -1, indexWithinAnchor = 0, indexWithinFocus = 0, node = root2, parentNode = null;
                b: for (; ; ) {
                  for (var next; ; ) {
                    node !== JSCompiler_temp || 0 !== anchorOffset && 3 !== node.nodeType || (start = length + anchorOffset);
                    node !== focusNode || 0 !== selection && 3 !== node.nodeType || (end = length + selection);
                    3 === node.nodeType && (length += node.nodeValue.length);
                    if (null === (next = node.firstChild)) break;
                    parentNode = node;
                    node = next;
                  }
                  for (; ; ) {
                    if (node === root2) break b;
                    parentNode === JSCompiler_temp && ++indexWithinAnchor === anchorOffset && (start = length);
                    parentNode === focusNode && ++indexWithinFocus === selection && (end = length);
                    if (null !== (next = node.nextSibling)) break;
                    node = parentNode;
                    parentNode = node.parentNode;
                  }
                  node = next;
                }
                JSCompiler_temp = -1 === start || -1 === end ? null : { start, end };
              } else JSCompiler_temp = null;
            }
          JSCompiler_temp = JSCompiler_temp || { start: 0, end: 0 };
        } else JSCompiler_temp = null;
        selectionInformation = { focusedElem: root2, selectionRange: JSCompiler_temp };
        _enabled = false;
        for (nextEffect = firstChild; null !== nextEffect; )
          if (firstChild = nextEffect, root2 = firstChild.child, 0 !== (firstChild.subtreeFlags & 1024) && null !== root2)
            root2.return = firstChild, nextEffect = root2;
          else
            for (; null !== nextEffect; ) {
              firstChild = nextEffect;
              focusNode = firstChild.alternate;
              root2 = firstChild.flags;
              switch (firstChild.tag) {
                case 0:
                  break;
                case 11:
                case 15:
                  break;
                case 1:
                  if (0 !== (root2 & 1024) && null !== focusNode) {
                    root2 = void 0;
                    JSCompiler_temp = firstChild;
                    anchorOffset = focusNode.memoizedProps;
                    focusNode = focusNode.memoizedState;
                    selection = JSCompiler_temp.stateNode;
                    try {
                      var resolvedPrevProps = resolveClassComponentProps(
                        JSCompiler_temp.type,
                        anchorOffset,
                        JSCompiler_temp.elementType === JSCompiler_temp.type
                      );
                      root2 = selection.getSnapshotBeforeUpdate(
                        resolvedPrevProps,
                        focusNode
                      );
                      selection.__reactInternalSnapshotBeforeUpdate = root2;
                    } catch (error) {
                      captureCommitPhaseError(
                        JSCompiler_temp,
                        JSCompiler_temp.return,
                        error
                      );
                    }
                  }
                  break;
                case 3:
                  if (0 !== (root2 & 1024)) {
                    if (root2 = firstChild.stateNode.containerInfo, JSCompiler_temp = root2.nodeType, 9 === JSCompiler_temp)
                      clearContainerSparingly(root2);
                    else if (1 === JSCompiler_temp)
                      switch (root2.nodeName) {
                        case "HEAD":
                        case "HTML":
                        case "BODY":
                          clearContainerSparingly(root2);
                          break;
                        default:
                          root2.textContent = "";
                      }
                  }
                  break;
                case 5:
                case 26:
                case 27:
                case 6:
                case 4:
                case 17:
                  break;
                default:
                  if (0 !== (root2 & 1024)) throw Error(formatProdErrorMessage(163));
              }
              root2 = firstChild.sibling;
              if (null !== root2) {
                root2.return = firstChild.return;
                nextEffect = root2;
                break;
              }
              nextEffect = firstChild.return;
            }
      }
      function commitLayoutEffectOnFiber(finishedRoot, current, finishedWork) {
        var flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 15:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            flags & 4 && commitHookEffectListMount(5, finishedWork);
            break;
          case 1:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            if (flags & 4)
              if (finishedRoot = finishedWork.stateNode, null === current)
                try {
                  finishedRoot.componentDidMount();
                } catch (error) {
                  captureCommitPhaseError(finishedWork, finishedWork.return, error);
                }
              else {
                var prevProps = resolveClassComponentProps(
                  finishedWork.type,
                  current.memoizedProps
                );
                current = current.memoizedState;
                try {
                  finishedRoot.componentDidUpdate(
                    prevProps,
                    current,
                    finishedRoot.__reactInternalSnapshotBeforeUpdate
                  );
                } catch (error$142) {
                  captureCommitPhaseError(
                    finishedWork,
                    finishedWork.return,
                    error$142
                  );
                }
              }
            flags & 64 && commitClassCallbacks(finishedWork);
            flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
            break;
          case 3:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            if (flags & 64 && (finishedRoot = finishedWork.updateQueue, null !== finishedRoot)) {
              current = null;
              if (null !== finishedWork.child)
                switch (finishedWork.child.tag) {
                  case 27:
                  case 5:
                    current = finishedWork.child.stateNode;
                    break;
                  case 1:
                    current = finishedWork.child.stateNode;
                }
              try {
                commitCallbacks(finishedRoot, current);
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
            break;
          case 27:
            null === current && flags & 4 && commitHostSingletonAcquisition(finishedWork);
          case 26:
          case 5:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            null === current && flags & 4 && commitHostMount(finishedWork);
            flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
            break;
          case 12:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            break;
          case 13:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
            flags & 64 && (finishedRoot = finishedWork.memoizedState, null !== finishedRoot && (finishedRoot = finishedRoot.dehydrated, null !== finishedRoot && (finishedWork = retryDehydratedSuspenseBoundary.bind(
              null,
              finishedWork
            ), registerSuspenseInstanceRetry(finishedRoot, finishedWork))));
            break;
          case 22:
            flags = null !== finishedWork.memoizedState || offscreenSubtreeIsHidden;
            if (!flags) {
              current = null !== current && null !== current.memoizedState || offscreenSubtreeWasHidden;
              prevProps = offscreenSubtreeIsHidden;
              var prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
              offscreenSubtreeIsHidden = flags;
              (offscreenSubtreeWasHidden = current) && !prevOffscreenSubtreeWasHidden ? recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                0 !== (finishedWork.subtreeFlags & 8772)
              ) : recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
              offscreenSubtreeIsHidden = prevProps;
              offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
            }
            break;
          case 30:
            break;
          default:
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
        }
      }
      function detachFiberAfterEffects(fiber) {
        var alternate = fiber.alternate;
        null !== alternate && (fiber.alternate = null, detachFiberAfterEffects(alternate));
        fiber.child = null;
        fiber.deletions = null;
        fiber.sibling = null;
        5 === fiber.tag && (alternate = fiber.stateNode, null !== alternate && detachDeletedInstance(alternate));
        fiber.stateNode = null;
        fiber.return = null;
        fiber.dependencies = null;
        fiber.memoizedProps = null;
        fiber.memoizedState = null;
        fiber.pendingProps = null;
        fiber.stateNode = null;
        fiber.updateQueue = null;
      }
      var hostParent = null;
      var hostParentIsContainer = false;
      function recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, parent) {
        for (parent = parent.child; null !== parent; )
          commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, parent), parent = parent.sibling;
      }
      function commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, deletedFiber) {
        if (injectedHook && "function" === typeof injectedHook.onCommitFiberUnmount)
          try {
            injectedHook.onCommitFiberUnmount(rendererID, deletedFiber);
          } catch (err) {
          }
        switch (deletedFiber.tag) {
          case 26:
            offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            deletedFiber.memoizedState ? deletedFiber.memoizedState.count-- : deletedFiber.stateNode && (deletedFiber = deletedFiber.stateNode, deletedFiber.parentNode.removeChild(deletedFiber));
            break;
          case 27:
            offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
            var prevHostParent = hostParent, prevHostParentIsContainer = hostParentIsContainer;
            isSingletonScope(deletedFiber.type) && (hostParent = deletedFiber.stateNode, hostParentIsContainer = false);
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            releaseSingletonInstance(deletedFiber.stateNode);
            hostParent = prevHostParent;
            hostParentIsContainer = prevHostParentIsContainer;
            break;
          case 5:
            offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
          case 6:
            prevHostParent = hostParent;
            prevHostParentIsContainer = hostParentIsContainer;
            hostParent = null;
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            hostParent = prevHostParent;
            hostParentIsContainer = prevHostParentIsContainer;
            if (null !== hostParent)
              if (hostParentIsContainer)
                try {
                  (9 === hostParent.nodeType ? hostParent.body : "HTML" === hostParent.nodeName ? hostParent.ownerDocument.body : hostParent).removeChild(deletedFiber.stateNode);
                } catch (error) {
                  captureCommitPhaseError(
                    deletedFiber,
                    nearestMountedAncestor,
                    error
                  );
                }
              else
                try {
                  hostParent.removeChild(deletedFiber.stateNode);
                } catch (error) {
                  captureCommitPhaseError(
                    deletedFiber,
                    nearestMountedAncestor,
                    error
                  );
                }
            break;
          case 18:
            null !== hostParent && (hostParentIsContainer ? (finishedRoot = hostParent, clearSuspenseBoundary(
              9 === finishedRoot.nodeType ? finishedRoot.body : "HTML" === finishedRoot.nodeName ? finishedRoot.ownerDocument.body : finishedRoot,
              deletedFiber.stateNode
            ), retryIfBlockedOn(finishedRoot)) : clearSuspenseBoundary(hostParent, deletedFiber.stateNode));
            break;
          case 4:
            prevHostParent = hostParent;
            prevHostParentIsContainer = hostParentIsContainer;
            hostParent = deletedFiber.stateNode.containerInfo;
            hostParentIsContainer = true;
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            hostParent = prevHostParent;
            hostParentIsContainer = prevHostParentIsContainer;
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            offscreenSubtreeWasHidden || commitHookEffectListUnmount(2, deletedFiber, nearestMountedAncestor);
            offscreenSubtreeWasHidden || commitHookEffectListUnmount(4, deletedFiber, nearestMountedAncestor);
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            break;
          case 1:
            offscreenSubtreeWasHidden || (safelyDetachRef(deletedFiber, nearestMountedAncestor), prevHostParent = deletedFiber.stateNode, "function" === typeof prevHostParent.componentWillUnmount && safelyCallComponentWillUnmount(
              deletedFiber,
              nearestMountedAncestor,
              prevHostParent
            ));
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            break;
          case 21:
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            break;
          case 22:
            offscreenSubtreeWasHidden = (prevHostParent = offscreenSubtreeWasHidden) || null !== deletedFiber.memoizedState;
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
            offscreenSubtreeWasHidden = prevHostParent;
            break;
          default:
            recursivelyTraverseDeletionEffects(
              finishedRoot,
              nearestMountedAncestor,
              deletedFiber
            );
        }
      }
      function commitSuspenseHydrationCallbacks(finishedRoot, finishedWork) {
        if (null === finishedWork.memoizedState && (finishedRoot = finishedWork.alternate, null !== finishedRoot && (finishedRoot = finishedRoot.memoizedState, null !== finishedRoot && (finishedRoot = finishedRoot.dehydrated, null !== finishedRoot))))
          try {
            retryIfBlockedOn(finishedRoot);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
      }
      function getRetryCache(finishedWork) {
        switch (finishedWork.tag) {
          case 13:
          case 19:
            var retryCache = finishedWork.stateNode;
            null === retryCache && (retryCache = finishedWork.stateNode = new PossiblyWeakSet());
            return retryCache;
          case 22:
            return finishedWork = finishedWork.stateNode, retryCache = finishedWork._retryCache, null === retryCache && (retryCache = finishedWork._retryCache = new PossiblyWeakSet()), retryCache;
          default:
            throw Error(formatProdErrorMessage(435, finishedWork.tag));
        }
      }
      function attachSuspenseRetryListeners(finishedWork, wakeables) {
        var retryCache = getRetryCache(finishedWork);
        wakeables.forEach(function(wakeable) {
          var retry = resolveRetryWakeable.bind(null, finishedWork, wakeable);
          retryCache.has(wakeable) || (retryCache.add(wakeable), wakeable.then(retry, retry));
        });
      }
      function recursivelyTraverseMutationEffects(root$jscomp$0, parentFiber) {
        var deletions = parentFiber.deletions;
        if (null !== deletions)
          for (var i = 0; i < deletions.length; i++) {
            var childToDelete = deletions[i], root2 = root$jscomp$0, returnFiber = parentFiber, parent = returnFiber;
            a: for (; null !== parent; ) {
              switch (parent.tag) {
                case 27:
                  if (isSingletonScope(parent.type)) {
                    hostParent = parent.stateNode;
                    hostParentIsContainer = false;
                    break a;
                  }
                  break;
                case 5:
                  hostParent = parent.stateNode;
                  hostParentIsContainer = false;
                  break a;
                case 3:
                case 4:
                  hostParent = parent.stateNode.containerInfo;
                  hostParentIsContainer = true;
                  break a;
              }
              parent = parent.return;
            }
            if (null === hostParent) throw Error(formatProdErrorMessage(160));
            commitDeletionEffectsOnFiber(root2, returnFiber, childToDelete);
            hostParent = null;
            hostParentIsContainer = false;
            root2 = childToDelete.alternate;
            null !== root2 && (root2.return = null);
            childToDelete.return = null;
          }
        if (parentFiber.subtreeFlags & 13878)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitMutationEffectsOnFiber(parentFiber, root$jscomp$0), parentFiber = parentFiber.sibling;
      }
      var currentHoistableRoot = null;
      function commitMutationEffectsOnFiber(finishedWork, root2) {
        var current = finishedWork.alternate, flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            flags & 4 && (commitHookEffectListUnmount(3, finishedWork, finishedWork.return), commitHookEffectListMount(3, finishedWork), commitHookEffectListUnmount(5, finishedWork, finishedWork.return));
            break;
          case 1:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            flags & 64 && offscreenSubtreeIsHidden && (finishedWork = finishedWork.updateQueue, null !== finishedWork && (flags = finishedWork.callbacks, null !== flags && (current = finishedWork.shared.hiddenCallbacks, finishedWork.shared.hiddenCallbacks = null === current ? flags : current.concat(flags))));
            break;
          case 26:
            var hoistableRoot = currentHoistableRoot;
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            if (flags & 4) {
              var currentResource = null !== current ? current.memoizedState : null;
              flags = finishedWork.memoizedState;
              if (null === current)
                if (null === flags)
                  if (null === finishedWork.stateNode) {
                    a: {
                      flags = finishedWork.type;
                      current = finishedWork.memoizedProps;
                      hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
                      b: switch (flags) {
                        case "title":
                          currentResource = hoistableRoot.getElementsByTagName("title")[0];
                          if (!currentResource || currentResource[internalHoistableMarker] || currentResource[internalInstanceKey] || "http://www.w3.org/2000/svg" === currentResource.namespaceURI || currentResource.hasAttribute("itemprop"))
                            currentResource = hoistableRoot.createElement(flags), hoistableRoot.head.insertBefore(
                              currentResource,
                              hoistableRoot.querySelector("head > title")
                            );
                          setInitialProperties(currentResource, flags, current);
                          currentResource[internalInstanceKey] = finishedWork;
                          markNodeAsHoistable(currentResource);
                          flags = currentResource;
                          break a;
                        case "link":
                          var maybeNodes = getHydratableHoistableCache(
                            "link",
                            "href",
                            hoistableRoot
                          ).get(flags + (current.href || ""));
                          if (maybeNodes) {
                            for (var i = 0; i < maybeNodes.length; i++)
                              if (currentResource = maybeNodes[i], currentResource.getAttribute("href") === (null == current.href || "" === current.href ? null : current.href) && currentResource.getAttribute("rel") === (null == current.rel ? null : current.rel) && currentResource.getAttribute("title") === (null == current.title ? null : current.title) && currentResource.getAttribute("crossorigin") === (null == current.crossOrigin ? null : current.crossOrigin)) {
                                maybeNodes.splice(i, 1);
                                break b;
                              }
                          }
                          currentResource = hoistableRoot.createElement(flags);
                          setInitialProperties(currentResource, flags, current);
                          hoistableRoot.head.appendChild(currentResource);
                          break;
                        case "meta":
                          if (maybeNodes = getHydratableHoistableCache(
                            "meta",
                            "content",
                            hoistableRoot
                          ).get(flags + (current.content || ""))) {
                            for (i = 0; i < maybeNodes.length; i++)
                              if (currentResource = maybeNodes[i], currentResource.getAttribute("content") === (null == current.content ? null : "" + current.content) && currentResource.getAttribute("name") === (null == current.name ? null : current.name) && currentResource.getAttribute("property") === (null == current.property ? null : current.property) && currentResource.getAttribute("http-equiv") === (null == current.httpEquiv ? null : current.httpEquiv) && currentResource.getAttribute("charset") === (null == current.charSet ? null : current.charSet)) {
                                maybeNodes.splice(i, 1);
                                break b;
                              }
                          }
                          currentResource = hoistableRoot.createElement(flags);
                          setInitialProperties(currentResource, flags, current);
                          hoistableRoot.head.appendChild(currentResource);
                          break;
                        default:
                          throw Error(formatProdErrorMessage(468, flags));
                      }
                      currentResource[internalInstanceKey] = finishedWork;
                      markNodeAsHoistable(currentResource);
                      flags = currentResource;
                    }
                    finishedWork.stateNode = flags;
                  } else
                    mountHoistable(
                      hoistableRoot,
                      finishedWork.type,
                      finishedWork.stateNode
                    );
                else
                  finishedWork.stateNode = acquireResource(
                    hoistableRoot,
                    flags,
                    finishedWork.memoizedProps
                  );
              else
                currentResource !== flags ? (null === currentResource ? null !== current.stateNode && (current = current.stateNode, current.parentNode.removeChild(current)) : currentResource.count--, null === flags ? mountHoistable(
                  hoistableRoot,
                  finishedWork.type,
                  finishedWork.stateNode
                ) : acquireResource(
                  hoistableRoot,
                  flags,
                  finishedWork.memoizedProps
                )) : null === flags && null !== finishedWork.stateNode && commitHostUpdate(
                  finishedWork,
                  finishedWork.memoizedProps,
                  current.memoizedProps
                );
            }
            break;
          case 27:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            null !== current && flags & 4 && commitHostUpdate(
              finishedWork,
              finishedWork.memoizedProps,
              current.memoizedProps
            );
            break;
          case 5:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
            if (finishedWork.flags & 32) {
              hoistableRoot = finishedWork.stateNode;
              try {
                setTextContent(hoistableRoot, "");
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
            flags & 4 && null != finishedWork.stateNode && (hoistableRoot = finishedWork.memoizedProps, commitHostUpdate(
              finishedWork,
              hoistableRoot,
              null !== current ? current.memoizedProps : hoistableRoot
            ));
            flags & 1024 && (needsFormReset = true);
            break;
          case 6:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            if (flags & 4) {
              if (null === finishedWork.stateNode)
                throw Error(formatProdErrorMessage(162));
              flags = finishedWork.memoizedProps;
              current = finishedWork.stateNode;
              try {
                current.nodeValue = flags;
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
            break;
          case 3:
            tagCaches = null;
            hoistableRoot = currentHoistableRoot;
            currentHoistableRoot = getHoistableRoot(root2.containerInfo);
            recursivelyTraverseMutationEffects(root2, finishedWork);
            currentHoistableRoot = hoistableRoot;
            commitReconciliationEffects(finishedWork);
            if (flags & 4 && null !== current && current.memoizedState.isDehydrated)
              try {
                retryIfBlockedOn(root2.containerInfo);
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            needsFormReset && (needsFormReset = false, recursivelyResetForms(finishedWork));
            break;
          case 4:
            flags = currentHoistableRoot;
            currentHoistableRoot = getHoistableRoot(
              finishedWork.stateNode.containerInfo
            );
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            currentHoistableRoot = flags;
            break;
          case 12:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            break;
          case 13:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            finishedWork.child.flags & 8192 && null !== finishedWork.memoizedState !== (null !== current && null !== current.memoizedState) && (globalMostRecentFallbackTime = now());
            flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
            break;
          case 22:
            hoistableRoot = null !== finishedWork.memoizedState;
            var wasHidden = null !== current && null !== current.memoizedState, prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden, prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
            offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden || hoistableRoot;
            offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden || wasHidden;
            recursivelyTraverseMutationEffects(root2, finishedWork);
            offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
            offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;
            commitReconciliationEffects(finishedWork);
            if (flags & 8192)
              a: for (root2 = finishedWork.stateNode, root2._visibility = hoistableRoot ? root2._visibility & -2 : root2._visibility | 1, hoistableRoot && (null === current || wasHidden || offscreenSubtreeIsHidden || offscreenSubtreeWasHidden || recursivelyTraverseDisappearLayoutEffects(finishedWork)), current = null, root2 = finishedWork; ; ) {
                if (5 === root2.tag || 26 === root2.tag) {
                  if (null === current) {
                    wasHidden = current = root2;
                    try {
                      if (currentResource = wasHidden.stateNode, hoistableRoot)
                        maybeNodes = currentResource.style, "function" === typeof maybeNodes.setProperty ? maybeNodes.setProperty("display", "none", "important") : maybeNodes.display = "none";
                      else {
                        i = wasHidden.stateNode;
                        var styleProp = wasHidden.memoizedProps.style, display = void 0 !== styleProp && null !== styleProp && styleProp.hasOwnProperty("display") ? styleProp.display : null;
                        i.style.display = null == display || "boolean" === typeof display ? "" : ("" + display).trim();
                      }
                    } catch (error) {
                      captureCommitPhaseError(wasHidden, wasHidden.return, error);
                    }
                  }
                } else if (6 === root2.tag) {
                  if (null === current) {
                    wasHidden = root2;
                    try {
                      wasHidden.stateNode.nodeValue = hoistableRoot ? "" : wasHidden.memoizedProps;
                    } catch (error) {
                      captureCommitPhaseError(wasHidden, wasHidden.return, error);
                    }
                  }
                } else if ((22 !== root2.tag && 23 !== root2.tag || null === root2.memoizedState || root2 === finishedWork) && null !== root2.child) {
                  root2.child.return = root2;
                  root2 = root2.child;
                  continue;
                }
                if (root2 === finishedWork) break a;
                for (; null === root2.sibling; ) {
                  if (null === root2.return || root2.return === finishedWork) break a;
                  current === root2 && (current = null);
                  root2 = root2.return;
                }
                current === root2 && (current = null);
                root2.sibling.return = root2.return;
                root2 = root2.sibling;
              }
            flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (current = flags.retryQueue, null !== current && (flags.retryQueue = null, attachSuspenseRetryListeners(finishedWork, current))));
            break;
          case 19:
            recursivelyTraverseMutationEffects(root2, finishedWork);
            commitReconciliationEffects(finishedWork);
            flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            recursivelyTraverseMutationEffects(root2, finishedWork), commitReconciliationEffects(finishedWork);
        }
      }
      function commitReconciliationEffects(finishedWork) {
        var flags = finishedWork.flags;
        if (flags & 2) {
          try {
            for (var hostParentFiber, parentFiber = finishedWork.return; null !== parentFiber; ) {
              if (isHostParent(parentFiber)) {
                hostParentFiber = parentFiber;
                break;
              }
              parentFiber = parentFiber.return;
            }
            if (null == hostParentFiber) throw Error(formatProdErrorMessage(160));
            switch (hostParentFiber.tag) {
              case 27:
                var parent = hostParentFiber.stateNode, before = getHostSibling(finishedWork);
                insertOrAppendPlacementNode(finishedWork, before, parent);
                break;
              case 5:
                var parent$144 = hostParentFiber.stateNode;
                hostParentFiber.flags & 32 && (setTextContent(parent$144, ""), hostParentFiber.flags &= -33);
                var before$145 = getHostSibling(finishedWork);
                insertOrAppendPlacementNode(finishedWork, before$145, parent$144);
                break;
              case 3:
              case 4:
                var parent$146 = hostParentFiber.stateNode.containerInfo, before$147 = getHostSibling(finishedWork);
                insertOrAppendPlacementNodeIntoContainer(
                  finishedWork,
                  before$147,
                  parent$146
                );
                break;
              default:
                throw Error(formatProdErrorMessage(161));
            }
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
          finishedWork.flags &= -3;
        }
        flags & 4096 && (finishedWork.flags &= -4097);
      }
      function recursivelyResetForms(parentFiber) {
        if (parentFiber.subtreeFlags & 1024)
          for (parentFiber = parentFiber.child; null !== parentFiber; ) {
            var fiber = parentFiber;
            recursivelyResetForms(fiber);
            5 === fiber.tag && fiber.flags & 1024 && fiber.stateNode.reset();
            parentFiber = parentFiber.sibling;
          }
      }
      function recursivelyTraverseLayoutEffects(root2, parentFiber) {
        if (parentFiber.subtreeFlags & 8772)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitLayoutEffectOnFiber(root2, parentFiber.alternate, parentFiber), parentFiber = parentFiber.sibling;
      }
      function recursivelyTraverseDisappearLayoutEffects(parentFiber) {
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          var finishedWork = parentFiber;
          switch (finishedWork.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              commitHookEffectListUnmount(4, finishedWork, finishedWork.return);
              recursivelyTraverseDisappearLayoutEffects(finishedWork);
              break;
            case 1:
              safelyDetachRef(finishedWork, finishedWork.return);
              var instance = finishedWork.stateNode;
              "function" === typeof instance.componentWillUnmount && safelyCallComponentWillUnmount(
                finishedWork,
                finishedWork.return,
                instance
              );
              recursivelyTraverseDisappearLayoutEffects(finishedWork);
              break;
            case 27:
              releaseSingletonInstance(finishedWork.stateNode);
            case 26:
            case 5:
              safelyDetachRef(finishedWork, finishedWork.return);
              recursivelyTraverseDisappearLayoutEffects(finishedWork);
              break;
            case 22:
              null === finishedWork.memoizedState && recursivelyTraverseDisappearLayoutEffects(finishedWork);
              break;
            case 30:
              recursivelyTraverseDisappearLayoutEffects(finishedWork);
              break;
            default:
              recursivelyTraverseDisappearLayoutEffects(finishedWork);
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function recursivelyTraverseReappearLayoutEffects(finishedRoot$jscomp$0, parentFiber, includeWorkInProgressEffects) {
        includeWorkInProgressEffects = includeWorkInProgressEffects && 0 !== (parentFiber.subtreeFlags & 8772);
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          var current = parentFiber.alternate, finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, flags = finishedWork.flags;
          switch (finishedWork.tag) {
            case 0:
            case 11:
            case 15:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              commitHookEffectListMount(4, finishedWork);
              break;
            case 1:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              current = finishedWork;
              finishedRoot = current.stateNode;
              if ("function" === typeof finishedRoot.componentDidMount)
                try {
                  finishedRoot.componentDidMount();
                } catch (error) {
                  captureCommitPhaseError(current, current.return, error);
                }
              current = finishedWork;
              finishedRoot = current.updateQueue;
              if (null !== finishedRoot) {
                var instance = current.stateNode;
                try {
                  var hiddenCallbacks = finishedRoot.shared.hiddenCallbacks;
                  if (null !== hiddenCallbacks)
                    for (finishedRoot.shared.hiddenCallbacks = null, finishedRoot = 0; finishedRoot < hiddenCallbacks.length; finishedRoot++)
                      callCallback(hiddenCallbacks[finishedRoot], instance);
                } catch (error) {
                  captureCommitPhaseError(current, current.return, error);
                }
              }
              includeWorkInProgressEffects && flags & 64 && commitClassCallbacks(finishedWork);
              safelyAttachRef(finishedWork, finishedWork.return);
              break;
            case 27:
              commitHostSingletonAcquisition(finishedWork);
            case 26:
            case 5:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              includeWorkInProgressEffects && null === current && flags & 4 && commitHostMount(finishedWork);
              safelyAttachRef(finishedWork, finishedWork.return);
              break;
            case 12:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              break;
            case 13:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              includeWorkInProgressEffects && flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
              break;
            case 22:
              null === finishedWork.memoizedState && recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
              safelyAttachRef(finishedWork, finishedWork.return);
              break;
            case 30:
              break;
            default:
              recursivelyTraverseReappearLayoutEffects(
                finishedRoot,
                finishedWork,
                includeWorkInProgressEffects
              );
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function commitOffscreenPassiveMountEffects(current, finishedWork) {
        var previousCache = null;
        null !== current && null !== current.memoizedState && null !== current.memoizedState.cachePool && (previousCache = current.memoizedState.cachePool.pool);
        current = null;
        null !== finishedWork.memoizedState && null !== finishedWork.memoizedState.cachePool && (current = finishedWork.memoizedState.cachePool.pool);
        current !== previousCache && (null != current && current.refCount++, null != previousCache && releaseCache(previousCache));
      }
      function commitCachePassiveMountEffect(current, finishedWork) {
        current = null;
        null !== finishedWork.alternate && (current = finishedWork.alternate.memoizedState.cache);
        finishedWork = finishedWork.memoizedState.cache;
        finishedWork !== current && (finishedWork.refCount++, null != current && releaseCache(current));
      }
      function recursivelyTraversePassiveMountEffects(root2, parentFiber, committedLanes, committedTransitions) {
        if (parentFiber.subtreeFlags & 10256)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitPassiveMountOnFiber(
              root2,
              parentFiber,
              committedLanes,
              committedTransitions
            ), parentFiber = parentFiber.sibling;
      }
      function commitPassiveMountOnFiber(finishedRoot, finishedWork, committedLanes, committedTransitions) {
        var flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 15:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            flags & 2048 && commitHookEffectListMount(9, finishedWork);
            break;
          case 1:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            break;
          case 3:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            flags & 2048 && (finishedRoot = null, null !== finishedWork.alternate && (finishedRoot = finishedWork.alternate.memoizedState.cache), finishedWork = finishedWork.memoizedState.cache, finishedWork !== finishedRoot && (finishedWork.refCount++, null != finishedRoot && releaseCache(finishedRoot)));
            break;
          case 12:
            if (flags & 2048) {
              recursivelyTraversePassiveMountEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions
              );
              finishedRoot = finishedWork.stateNode;
              try {
                var _finishedWork$memoize2 = finishedWork.memoizedProps, id = _finishedWork$memoize2.id, onPostCommit = _finishedWork$memoize2.onPostCommit;
                "function" === typeof onPostCommit && onPostCommit(
                  id,
                  null === finishedWork.alternate ? "mount" : "update",
                  finishedRoot.passiveEffectDuration,
                  -0
                );
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            } else
              recursivelyTraversePassiveMountEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions
              );
            break;
          case 13:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            break;
          case 23:
            break;
          case 22:
            _finishedWork$memoize2 = finishedWork.stateNode;
            id = finishedWork.alternate;
            null !== finishedWork.memoizedState ? _finishedWork$memoize2._visibility & 2 ? recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            ) : recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork) : _finishedWork$memoize2._visibility & 2 ? recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            ) : (_finishedWork$memoize2._visibility |= 2, recursivelyTraverseReconnectPassiveEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions,
              0 !== (finishedWork.subtreeFlags & 10256)
            ));
            flags & 2048 && commitOffscreenPassiveMountEffects(id, finishedWork);
            break;
          case 24:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
            break;
          default:
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
        }
      }
      function recursivelyTraverseReconnectPassiveEffects(finishedRoot$jscomp$0, parentFiber, committedLanes$jscomp$0, committedTransitions$jscomp$0, includeWorkInProgressEffects) {
        includeWorkInProgressEffects = includeWorkInProgressEffects && 0 !== (parentFiber.subtreeFlags & 10256);
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          var finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, committedLanes = committedLanes$jscomp$0, committedTransitions = committedTransitions$jscomp$0, flags = finishedWork.flags;
          switch (finishedWork.tag) {
            case 0:
            case 11:
            case 15:
              recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              );
              commitHookEffectListMount(8, finishedWork);
              break;
            case 23:
              break;
            case 22:
              var instance = finishedWork.stateNode;
              null !== finishedWork.memoizedState ? instance._visibility & 2 ? recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              ) : recursivelyTraverseAtomicPassiveEffects(
                finishedRoot,
                finishedWork
              ) : (instance._visibility |= 2, recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              ));
              includeWorkInProgressEffects && flags & 2048 && commitOffscreenPassiveMountEffects(
                finishedWork.alternate,
                finishedWork
              );
              break;
            case 24:
              recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              );
              includeWorkInProgressEffects && flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
              break;
            default:
              recursivelyTraverseReconnectPassiveEffects(
                finishedRoot,
                finishedWork,
                committedLanes,
                committedTransitions,
                includeWorkInProgressEffects
              );
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function recursivelyTraverseAtomicPassiveEffects(finishedRoot$jscomp$0, parentFiber) {
        if (parentFiber.subtreeFlags & 10256)
          for (parentFiber = parentFiber.child; null !== parentFiber; ) {
            var finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, flags = finishedWork.flags;
            switch (finishedWork.tag) {
              case 22:
                recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
                flags & 2048 && commitOffscreenPassiveMountEffects(
                  finishedWork.alternate,
                  finishedWork
                );
                break;
              case 24:
                recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
                flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
                break;
              default:
                recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
            }
            parentFiber = parentFiber.sibling;
          }
      }
      var suspenseyCommitFlag = 8192;
      function recursivelyAccumulateSuspenseyCommit(parentFiber) {
        if (parentFiber.subtreeFlags & suspenseyCommitFlag)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            accumulateSuspenseyCommitOnFiber(parentFiber), parentFiber = parentFiber.sibling;
      }
      function accumulateSuspenseyCommitOnFiber(fiber) {
        switch (fiber.tag) {
          case 26:
            recursivelyAccumulateSuspenseyCommit(fiber);
            fiber.flags & suspenseyCommitFlag && null !== fiber.memoizedState && suspendResource(
              currentHoistableRoot,
              fiber.memoizedState,
              fiber.memoizedProps
            );
            break;
          case 5:
            recursivelyAccumulateSuspenseyCommit(fiber);
            break;
          case 3:
          case 4:
            var previousHoistableRoot = currentHoistableRoot;
            currentHoistableRoot = getHoistableRoot(fiber.stateNode.containerInfo);
            recursivelyAccumulateSuspenseyCommit(fiber);
            currentHoistableRoot = previousHoistableRoot;
            break;
          case 22:
            null === fiber.memoizedState && (previousHoistableRoot = fiber.alternate, null !== previousHoistableRoot && null !== previousHoistableRoot.memoizedState ? (previousHoistableRoot = suspenseyCommitFlag, suspenseyCommitFlag = 16777216, recursivelyAccumulateSuspenseyCommit(fiber), suspenseyCommitFlag = previousHoistableRoot) : recursivelyAccumulateSuspenseyCommit(fiber));
            break;
          default:
            recursivelyAccumulateSuspenseyCommit(fiber);
        }
      }
      function detachAlternateSiblings(parentFiber) {
        var previousFiber = parentFiber.alternate;
        if (null !== previousFiber && (parentFiber = previousFiber.child, null !== parentFiber)) {
          previousFiber.child = null;
          do
            previousFiber = parentFiber.sibling, parentFiber.sibling = null, parentFiber = previousFiber;
          while (null !== parentFiber);
        }
      }
      function recursivelyTraversePassiveUnmountEffects(parentFiber) {
        var deletions = parentFiber.deletions;
        if (0 !== (parentFiber.flags & 16)) {
          if (null !== deletions)
            for (var i = 0; i < deletions.length; i++) {
              var childToDelete = deletions[i];
              nextEffect = childToDelete;
              commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
                childToDelete,
                parentFiber
              );
            }
          detachAlternateSiblings(parentFiber);
        }
        if (parentFiber.subtreeFlags & 10256)
          for (parentFiber = parentFiber.child; null !== parentFiber; )
            commitPassiveUnmountOnFiber(parentFiber), parentFiber = parentFiber.sibling;
      }
      function commitPassiveUnmountOnFiber(finishedWork) {
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 15:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
            finishedWork.flags & 2048 && commitHookEffectListUnmount(9, finishedWork, finishedWork.return);
            break;
          case 3:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
            break;
          case 12:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
            break;
          case 22:
            var instance = finishedWork.stateNode;
            null !== finishedWork.memoizedState && instance._visibility & 2 && (null === finishedWork.return || 13 !== finishedWork.return.tag) ? (instance._visibility &= -3, recursivelyTraverseDisconnectPassiveEffects(finishedWork)) : recursivelyTraversePassiveUnmountEffects(finishedWork);
            break;
          default:
            recursivelyTraversePassiveUnmountEffects(finishedWork);
        }
      }
      function recursivelyTraverseDisconnectPassiveEffects(parentFiber) {
        var deletions = parentFiber.deletions;
        if (0 !== (parentFiber.flags & 16)) {
          if (null !== deletions)
            for (var i = 0; i < deletions.length; i++) {
              var childToDelete = deletions[i];
              nextEffect = childToDelete;
              commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
                childToDelete,
                parentFiber
              );
            }
          detachAlternateSiblings(parentFiber);
        }
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          deletions = parentFiber;
          switch (deletions.tag) {
            case 0:
            case 11:
            case 15:
              commitHookEffectListUnmount(8, deletions, deletions.return);
              recursivelyTraverseDisconnectPassiveEffects(deletions);
              break;
            case 22:
              i = deletions.stateNode;
              i._visibility & 2 && (i._visibility &= -3, recursivelyTraverseDisconnectPassiveEffects(deletions));
              break;
            default:
              recursivelyTraverseDisconnectPassiveEffects(deletions);
          }
          parentFiber = parentFiber.sibling;
        }
      }
      function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(deletedSubtreeRoot, nearestMountedAncestor) {
        for (; null !== nextEffect; ) {
          var fiber = nextEffect;
          switch (fiber.tag) {
            case 0:
            case 11:
            case 15:
              commitHookEffectListUnmount(8, fiber, nearestMountedAncestor);
              break;
            case 23:
            case 22:
              if (null !== fiber.memoizedState && null !== fiber.memoizedState.cachePool) {
                var cache4 = fiber.memoizedState.cachePool.pool;
                null != cache4 && cache4.refCount++;
              }
              break;
            case 24:
              releaseCache(fiber.memoizedState.cache);
          }
          cache4 = fiber.child;
          if (null !== cache4) cache4.return = fiber, nextEffect = cache4;
          else
            a: for (fiber = deletedSubtreeRoot; null !== nextEffect; ) {
              cache4 = nextEffect;
              var sibling = cache4.sibling, returnFiber = cache4.return;
              detachFiberAfterEffects(cache4);
              if (cache4 === fiber) {
                nextEffect = null;
                break a;
              }
              if (null !== sibling) {
                sibling.return = returnFiber;
                nextEffect = sibling;
                break a;
              }
              nextEffect = returnFiber;
            }
        }
      }
      var DefaultAsyncDispatcher = {
        getCacheForType: function(resourceType) {
          var cache4 = readContext(CacheContext), cacheForType = cache4.data.get(resourceType);
          void 0 === cacheForType && (cacheForType = resourceType(), cache4.data.set(resourceType, cacheForType));
          return cacheForType;
        }
      };
      var PossiblyWeakMap = "function" === typeof WeakMap ? WeakMap : Map;
      var executionContext = 0;
      var workInProgressRoot = null;
      var workInProgress = null;
      var workInProgressRootRenderLanes = 0;
      var workInProgressSuspendedReason = 0;
      var workInProgressThrownValue = null;
      var workInProgressRootDidSkipSuspendedSiblings = false;
      var workInProgressRootIsPrerendering = false;
      var workInProgressRootDidAttachPingListener = false;
      var entangledRenderLanes = 0;
      var workInProgressRootExitStatus = 0;
      var workInProgressRootSkippedLanes = 0;
      var workInProgressRootInterleavedUpdatedLanes = 0;
      var workInProgressRootPingedLanes = 0;
      var workInProgressDeferredLane = 0;
      var workInProgressSuspendedRetryLanes = 0;
      var workInProgressRootConcurrentErrors = null;
      var workInProgressRootRecoverableErrors = null;
      var workInProgressRootDidIncludeRecursiveRenderUpdate = false;
      var globalMostRecentFallbackTime = 0;
      var workInProgressRootRenderTargetTime = Infinity;
      var workInProgressTransitions = null;
      var legacyErrorBoundariesThatAlreadyFailed = null;
      var pendingEffectsStatus = 0;
      var pendingEffectsRoot = null;
      var pendingFinishedWork = null;
      var pendingEffectsLanes = 0;
      var pendingEffectsRemainingLanes = 0;
      var pendingPassiveTransitions = null;
      var pendingRecoverableErrors = null;
      var nestedUpdateCount = 0;
      var rootWithNestedUpdates = null;
      function requestUpdateLane() {
        if (0 !== (executionContext & 2) && 0 !== workInProgressRootRenderLanes)
          return workInProgressRootRenderLanes & -workInProgressRootRenderLanes;
        if (null !== ReactSharedInternals.T) {
          var actionScopeLane = currentEntangledLane;
          return 0 !== actionScopeLane ? actionScopeLane : requestTransitionLane();
        }
        return resolveUpdatePriority();
      }
      function requestDeferredLane() {
        0 === workInProgressDeferredLane && (workInProgressDeferredLane = 0 === (workInProgressRootRenderLanes & 536870912) || isHydrating ? claimNextTransitionLane() : 536870912);
        var suspenseHandler = suspenseHandlerStackCursor.current;
        null !== suspenseHandler && (suspenseHandler.flags |= 32);
        return workInProgressDeferredLane;
      }
      function scheduleUpdateOnFiber(root2, fiber, lane) {
        if (root2 === workInProgressRoot && (2 === workInProgressSuspendedReason || 9 === workInProgressSuspendedReason) || null !== root2.cancelPendingCommit)
          prepareFreshStack(root2, 0), markRootSuspended(
            root2,
            workInProgressRootRenderLanes,
            workInProgressDeferredLane,
            false
          );
        markRootUpdated$1(root2, lane);
        if (0 === (executionContext & 2) || root2 !== workInProgressRoot)
          root2 === workInProgressRoot && (0 === (executionContext & 2) && (workInProgressRootInterleavedUpdatedLanes |= lane), 4 === workInProgressRootExitStatus && markRootSuspended(
            root2,
            workInProgressRootRenderLanes,
            workInProgressDeferredLane,
            false
          )), ensureRootIsScheduled(root2);
      }
      function performWorkOnRoot(root$jscomp$0, lanes, forceSync) {
        if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(327));
        var shouldTimeSlice = !forceSync && 0 === (lanes & 124) && 0 === (lanes & root$jscomp$0.expiredLanes) || checkIfRootIsPrerendering(root$jscomp$0, lanes), exitStatus = shouldTimeSlice ? renderRootConcurrent(root$jscomp$0, lanes) : renderRootSync(root$jscomp$0, lanes, true), renderWasConcurrent = shouldTimeSlice;
        do {
          if (0 === exitStatus) {
            workInProgressRootIsPrerendering && !shouldTimeSlice && markRootSuspended(root$jscomp$0, lanes, 0, false);
            break;
          } else {
            forceSync = root$jscomp$0.current.alternate;
            if (renderWasConcurrent && !isRenderConsistentWithExternalStores(forceSync)) {
              exitStatus = renderRootSync(root$jscomp$0, lanes, false);
              renderWasConcurrent = false;
              continue;
            }
            if (2 === exitStatus) {
              renderWasConcurrent = lanes;
              if (root$jscomp$0.errorRecoveryDisabledLanes & renderWasConcurrent)
                var JSCompiler_inline_result = 0;
              else
                JSCompiler_inline_result = root$jscomp$0.pendingLanes & -536870913, JSCompiler_inline_result = 0 !== JSCompiler_inline_result ? JSCompiler_inline_result : JSCompiler_inline_result & 536870912 ? 536870912 : 0;
              if (0 !== JSCompiler_inline_result) {
                lanes = JSCompiler_inline_result;
                a: {
                  var root2 = root$jscomp$0;
                  exitStatus = workInProgressRootConcurrentErrors;
                  var wasRootDehydrated = root2.current.memoizedState.isDehydrated;
                  wasRootDehydrated && (prepareFreshStack(root2, JSCompiler_inline_result).flags |= 256);
                  JSCompiler_inline_result = renderRootSync(
                    root2,
                    JSCompiler_inline_result,
                    false
                  );
                  if (2 !== JSCompiler_inline_result) {
                    if (workInProgressRootDidAttachPingListener && !wasRootDehydrated) {
                      root2.errorRecoveryDisabledLanes |= renderWasConcurrent;
                      workInProgressRootInterleavedUpdatedLanes |= renderWasConcurrent;
                      exitStatus = 4;
                      break a;
                    }
                    renderWasConcurrent = workInProgressRootRecoverableErrors;
                    workInProgressRootRecoverableErrors = exitStatus;
                    null !== renderWasConcurrent && (null === workInProgressRootRecoverableErrors ? workInProgressRootRecoverableErrors = renderWasConcurrent : workInProgressRootRecoverableErrors.push.apply(
                      workInProgressRootRecoverableErrors,
                      renderWasConcurrent
                    ));
                  }
                  exitStatus = JSCompiler_inline_result;
                }
                renderWasConcurrent = false;
                if (2 !== exitStatus) continue;
              }
            }
            if (1 === exitStatus) {
              prepareFreshStack(root$jscomp$0, 0);
              markRootSuspended(root$jscomp$0, lanes, 0, true);
              break;
            }
            a: {
              shouldTimeSlice = root$jscomp$0;
              renderWasConcurrent = exitStatus;
              switch (renderWasConcurrent) {
                case 0:
                case 1:
                  throw Error(formatProdErrorMessage(345));
                case 4:
                  if ((lanes & 4194048) !== lanes) break;
                case 6:
                  markRootSuspended(
                    shouldTimeSlice,
                    lanes,
                    workInProgressDeferredLane,
                    !workInProgressRootDidSkipSuspendedSiblings
                  );
                  break a;
                case 2:
                  workInProgressRootRecoverableErrors = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(formatProdErrorMessage(329));
              }
              if ((lanes & 62914560) === lanes && (exitStatus = globalMostRecentFallbackTime + 300 - now(), 10 < exitStatus)) {
                markRootSuspended(
                  shouldTimeSlice,
                  lanes,
                  workInProgressDeferredLane,
                  !workInProgressRootDidSkipSuspendedSiblings
                );
                if (0 !== getNextLanes(shouldTimeSlice, 0, true)) break a;
                shouldTimeSlice.timeoutHandle = scheduleTimeout(
                  commitRootWhenReady.bind(
                    null,
                    shouldTimeSlice,
                    forceSync,
                    workInProgressRootRecoverableErrors,
                    workInProgressTransitions,
                    workInProgressRootDidIncludeRecursiveRenderUpdate,
                    lanes,
                    workInProgressDeferredLane,
                    workInProgressRootInterleavedUpdatedLanes,
                    workInProgressSuspendedRetryLanes,
                    workInProgressRootDidSkipSuspendedSiblings,
                    renderWasConcurrent,
                    2,
                    -0,
                    0
                  ),
                  exitStatus
                );
                break a;
              }
              commitRootWhenReady(
                shouldTimeSlice,
                forceSync,
                workInProgressRootRecoverableErrors,
                workInProgressTransitions,
                workInProgressRootDidIncludeRecursiveRenderUpdate,
                lanes,
                workInProgressDeferredLane,
                workInProgressRootInterleavedUpdatedLanes,
                workInProgressSuspendedRetryLanes,
                workInProgressRootDidSkipSuspendedSiblings,
                renderWasConcurrent,
                0,
                -0,
                0
              );
            }
          }
          break;
        } while (1);
        ensureRootIsScheduled(root$jscomp$0);
      }
      function commitRootWhenReady(root2, finishedWork, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, lanes, spawnedLane, updatedLanes, suspendedRetryLanes, didSkipSuspendedSiblings, exitStatus, suspendedCommitReason, completedRenderStartTime, completedRenderEndTime) {
        root2.timeoutHandle = -1;
        suspendedCommitReason = finishedWork.subtreeFlags;
        if (suspendedCommitReason & 8192 || 16785408 === (suspendedCommitReason & 16785408)) {
          if (suspendedState = { stylesheets: null, count: 0, unsuspend: noop }, accumulateSuspenseyCommitOnFiber(finishedWork), suspendedCommitReason = waitForCommitToBeReady(), null !== suspendedCommitReason) {
            root2.cancelPendingCommit = suspendedCommitReason(
              commitRoot.bind(
                null,
                root2,
                finishedWork,
                lanes,
                recoverableErrors,
                transitions,
                didIncludeRenderPhaseUpdate,
                spawnedLane,
                updatedLanes,
                suspendedRetryLanes,
                exitStatus,
                1,
                completedRenderStartTime,
                completedRenderEndTime
              )
            );
            markRootSuspended(root2, lanes, spawnedLane, !didSkipSuspendedSiblings);
            return;
          }
        }
        commitRoot(
          root2,
          finishedWork,
          lanes,
          recoverableErrors,
          transitions,
          didIncludeRenderPhaseUpdate,
          spawnedLane,
          updatedLanes,
          suspendedRetryLanes
        );
      }
      function isRenderConsistentWithExternalStores(finishedWork) {
        for (var node = finishedWork; ; ) {
          var tag = node.tag;
          if ((0 === tag || 11 === tag || 15 === tag) && node.flags & 16384 && (tag = node.updateQueue, null !== tag && (tag = tag.stores, null !== tag)))
            for (var i = 0; i < tag.length; i++) {
              var check = tag[i], getSnapshot = check.getSnapshot;
              check = check.value;
              try {
                if (!objectIs(getSnapshot(), check)) return false;
              } catch (error) {
                return false;
              }
            }
          tag = node.child;
          if (node.subtreeFlags & 16384 && null !== tag)
            tag.return = node, node = tag;
          else {
            if (node === finishedWork) break;
            for (; null === node.sibling; ) {
              if (null === node.return || node.return === finishedWork) return true;
              node = node.return;
            }
            node.sibling.return = node.return;
            node = node.sibling;
          }
        }
        return true;
      }
      function markRootSuspended(root2, suspendedLanes, spawnedLane, didAttemptEntireTree) {
        suspendedLanes &= ~workInProgressRootPingedLanes;
        suspendedLanes &= ~workInProgressRootInterleavedUpdatedLanes;
        root2.suspendedLanes |= suspendedLanes;
        root2.pingedLanes &= ~suspendedLanes;
        didAttemptEntireTree && (root2.warmLanes |= suspendedLanes);
        didAttemptEntireTree = root2.expirationTimes;
        for (var lanes = suspendedLanes; 0 < lanes; ) {
          var index$4 = 31 - clz32(lanes), lane = 1 << index$4;
          didAttemptEntireTree[index$4] = -1;
          lanes &= ~lane;
        }
        0 !== spawnedLane && markSpawnedDeferredLane(root2, spawnedLane, suspendedLanes);
      }
      function flushSyncWork$1() {
        return 0 === (executionContext & 6) ? (flushSyncWorkAcrossRoots_impl(0, false), false) : true;
      }
      function resetWorkInProgressStack() {
        if (null !== workInProgress) {
          if (0 === workInProgressSuspendedReason)
            var interruptedWork = workInProgress.return;
          else
            interruptedWork = workInProgress, lastContextDependency = currentlyRenderingFiber$1 = null, resetHooksOnUnwind(interruptedWork), thenableState = null, thenableIndexCounter = 0, interruptedWork = workInProgress;
          for (; null !== interruptedWork; )
            unwindInterruptedWork(interruptedWork.alternate, interruptedWork), interruptedWork = interruptedWork.return;
          workInProgress = null;
        }
      }
      function prepareFreshStack(root2, lanes) {
        var timeoutHandle = root2.timeoutHandle;
        -1 !== timeoutHandle && (root2.timeoutHandle = -1, cancelTimeout(timeoutHandle));
        timeoutHandle = root2.cancelPendingCommit;
        null !== timeoutHandle && (root2.cancelPendingCommit = null, timeoutHandle());
        resetWorkInProgressStack();
        workInProgressRoot = root2;
        workInProgress = timeoutHandle = createWorkInProgress(root2.current, null);
        workInProgressRootRenderLanes = lanes;
        workInProgressSuspendedReason = 0;
        workInProgressThrownValue = null;
        workInProgressRootDidSkipSuspendedSiblings = false;
        workInProgressRootIsPrerendering = checkIfRootIsPrerendering(root2, lanes);
        workInProgressRootDidAttachPingListener = false;
        workInProgressSuspendedRetryLanes = workInProgressDeferredLane = workInProgressRootPingedLanes = workInProgressRootInterleavedUpdatedLanes = workInProgressRootSkippedLanes = workInProgressRootExitStatus = 0;
        workInProgressRootRecoverableErrors = workInProgressRootConcurrentErrors = null;
        workInProgressRootDidIncludeRecursiveRenderUpdate = false;
        0 !== (lanes & 8) && (lanes |= lanes & 32);
        var allEntangledLanes = root2.entangledLanes;
        if (0 !== allEntangledLanes)
          for (root2 = root2.entanglements, allEntangledLanes &= lanes; 0 < allEntangledLanes; ) {
            var index$2 = 31 - clz32(allEntangledLanes), lane = 1 << index$2;
            lanes |= root2[index$2];
            allEntangledLanes &= ~lane;
          }
        entangledRenderLanes = lanes;
        finishQueueingConcurrentUpdates();
        return timeoutHandle;
      }
      function handleThrow(root2, thrownValue) {
        currentlyRenderingFiber = null;
        ReactSharedInternals.H = ContextOnlyDispatcher;
        thrownValue === SuspenseException || thrownValue === SuspenseActionException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 3) : thrownValue === SuspenseyCommitException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 4) : workInProgressSuspendedReason = thrownValue === SelectiveHydrationException ? 8 : null !== thrownValue && "object" === typeof thrownValue && "function" === typeof thrownValue.then ? 6 : 1;
        workInProgressThrownValue = thrownValue;
        null === workInProgress && (workInProgressRootExitStatus = 1, logUncaughtError(
          root2,
          createCapturedValueAtFiber(thrownValue, root2.current)
        ));
      }
      function pushDispatcher() {
        var prevDispatcher = ReactSharedInternals.H;
        ReactSharedInternals.H = ContextOnlyDispatcher;
        return null === prevDispatcher ? ContextOnlyDispatcher : prevDispatcher;
      }
      function pushAsyncDispatcher() {
        var prevAsyncDispatcher = ReactSharedInternals.A;
        ReactSharedInternals.A = DefaultAsyncDispatcher;
        return prevAsyncDispatcher;
      }
      function renderDidSuspendDelayIfPossible() {
        workInProgressRootExitStatus = 4;
        workInProgressRootDidSkipSuspendedSiblings || (workInProgressRootRenderLanes & 4194048) !== workInProgressRootRenderLanes && null !== suspenseHandlerStackCursor.current || (workInProgressRootIsPrerendering = true);
        0 === (workInProgressRootSkippedLanes & 134217727) && 0 === (workInProgressRootInterleavedUpdatedLanes & 134217727) || null === workInProgressRoot || markRootSuspended(
          workInProgressRoot,
          workInProgressRootRenderLanes,
          workInProgressDeferredLane,
          false
        );
      }
      function renderRootSync(root2, lanes, shouldYieldForPrerendering) {
        var prevExecutionContext = executionContext;
        executionContext |= 2;
        var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
        if (workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes)
          workInProgressTransitions = null, prepareFreshStack(root2, lanes);
        lanes = false;
        var exitStatus = workInProgressRootExitStatus;
        a: do
          try {
            if (0 !== workInProgressSuspendedReason && null !== workInProgress) {
              var unitOfWork = workInProgress, thrownValue = workInProgressThrownValue;
              switch (workInProgressSuspendedReason) {
                case 8:
                  resetWorkInProgressStack();
                  exitStatus = 6;
                  break a;
                case 3:
                case 2:
                case 9:
                case 6:
                  null === suspenseHandlerStackCursor.current && (lanes = true);
                  var reason = workInProgressSuspendedReason;
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
                  if (shouldYieldForPrerendering && workInProgressRootIsPrerendering) {
                    exitStatus = 0;
                    break a;
                  }
                  break;
                default:
                  reason = workInProgressSuspendedReason, workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
              }
            }
            workLoopSync();
            exitStatus = workInProgressRootExitStatus;
            break;
          } catch (thrownValue$167) {
            handleThrow(root2, thrownValue$167);
          }
        while (1);
        lanes && root2.shellSuspendCounter++;
        lastContextDependency = currentlyRenderingFiber$1 = null;
        executionContext = prevExecutionContext;
        ReactSharedInternals.H = prevDispatcher;
        ReactSharedInternals.A = prevAsyncDispatcher;
        null === workInProgress && (workInProgressRoot = null, workInProgressRootRenderLanes = 0, finishQueueingConcurrentUpdates());
        return exitStatus;
      }
      function workLoopSync() {
        for (; null !== workInProgress; ) performUnitOfWork(workInProgress);
      }
      function renderRootConcurrent(root2, lanes) {
        var prevExecutionContext = executionContext;
        executionContext |= 2;
        var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
        workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes ? (workInProgressTransitions = null, workInProgressRootRenderTargetTime = now() + 500, prepareFreshStack(root2, lanes)) : workInProgressRootIsPrerendering = checkIfRootIsPrerendering(
          root2,
          lanes
        );
        a: do
          try {
            if (0 !== workInProgressSuspendedReason && null !== workInProgress) {
              lanes = workInProgress;
              var thrownValue = workInProgressThrownValue;
              b: switch (workInProgressSuspendedReason) {
                case 1:
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, lanes, thrownValue, 1);
                  break;
                case 2:
                case 9:
                  if (isThenableResolved(thrownValue)) {
                    workInProgressSuspendedReason = 0;
                    workInProgressThrownValue = null;
                    replaySuspendedUnitOfWork(lanes);
                    break;
                  }
                  lanes = function() {
                    2 !== workInProgressSuspendedReason && 9 !== workInProgressSuspendedReason || workInProgressRoot !== root2 || (workInProgressSuspendedReason = 7);
                    ensureRootIsScheduled(root2);
                  };
                  thrownValue.then(lanes, lanes);
                  break a;
                case 3:
                  workInProgressSuspendedReason = 7;
                  break a;
                case 4:
                  workInProgressSuspendedReason = 5;
                  break a;
                case 7:
                  isThenableResolved(thrownValue) ? (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, replaySuspendedUnitOfWork(lanes)) : (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, lanes, thrownValue, 7));
                  break;
                case 5:
                  var resource = null;
                  switch (workInProgress.tag) {
                    case 26:
                      resource = workInProgress.memoizedState;
                    case 5:
                    case 27:
                      var hostFiber = workInProgress;
                      if (resource ? preloadResource(resource) : 1) {
                        workInProgressSuspendedReason = 0;
                        workInProgressThrownValue = null;
                        var sibling = hostFiber.sibling;
                        if (null !== sibling) workInProgress = sibling;
                        else {
                          var returnFiber = hostFiber.return;
                          null !== returnFiber ? (workInProgress = returnFiber, completeUnitOfWork(returnFiber)) : workInProgress = null;
                        }
                        break b;
                      }
                  }
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, lanes, thrownValue, 5);
                  break;
                case 6:
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  throwAndUnwindWorkLoop(root2, lanes, thrownValue, 6);
                  break;
                case 8:
                  resetWorkInProgressStack();
                  workInProgressRootExitStatus = 6;
                  break a;
                default:
                  throw Error(formatProdErrorMessage(462));
              }
            }
            workLoopConcurrentByScheduler();
            break;
          } catch (thrownValue$169) {
            handleThrow(root2, thrownValue$169);
          }
        while (1);
        lastContextDependency = currentlyRenderingFiber$1 = null;
        ReactSharedInternals.H = prevDispatcher;
        ReactSharedInternals.A = prevAsyncDispatcher;
        executionContext = prevExecutionContext;
        if (null !== workInProgress) return 0;
        workInProgressRoot = null;
        workInProgressRootRenderLanes = 0;
        finishQueueingConcurrentUpdates();
        return workInProgressRootExitStatus;
      }
      function workLoopConcurrentByScheduler() {
        for (; null !== workInProgress && !shouldYield(); )
          performUnitOfWork(workInProgress);
      }
      function performUnitOfWork(unitOfWork) {
        var next = beginWork(unitOfWork.alternate, unitOfWork, entangledRenderLanes);
        unitOfWork.memoizedProps = unitOfWork.pendingProps;
        null === next ? completeUnitOfWork(unitOfWork) : workInProgress = next;
      }
      function replaySuspendedUnitOfWork(unitOfWork) {
        var next = unitOfWork;
        var current = next.alternate;
        switch (next.tag) {
          case 15:
          case 0:
            next = replayFunctionComponent(
              current,
              next,
              next.pendingProps,
              next.type,
              void 0,
              workInProgressRootRenderLanes
            );
            break;
          case 11:
            next = replayFunctionComponent(
              current,
              next,
              next.pendingProps,
              next.type.render,
              next.ref,
              workInProgressRootRenderLanes
            );
            break;
          case 5:
            resetHooksOnUnwind(next);
          default:
            unwindInterruptedWork(current, next), next = workInProgress = resetWorkInProgress(next, entangledRenderLanes), next = beginWork(current, next, entangledRenderLanes);
        }
        unitOfWork.memoizedProps = unitOfWork.pendingProps;
        null === next ? completeUnitOfWork(unitOfWork) : workInProgress = next;
      }
      function throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, suspendedReason) {
        lastContextDependency = currentlyRenderingFiber$1 = null;
        resetHooksOnUnwind(unitOfWork);
        thenableState = null;
        thenableIndexCounter = 0;
        var returnFiber = unitOfWork.return;
        try {
          if (throwException(
            root2,
            returnFiber,
            unitOfWork,
            thrownValue,
            workInProgressRootRenderLanes
          )) {
            workInProgressRootExitStatus = 1;
            logUncaughtError(
              root2,
              createCapturedValueAtFiber(thrownValue, root2.current)
            );
            workInProgress = null;
            return;
          }
        } catch (error) {
          if (null !== returnFiber) throw workInProgress = returnFiber, error;
          workInProgressRootExitStatus = 1;
          logUncaughtError(
            root2,
            createCapturedValueAtFiber(thrownValue, root2.current)
          );
          workInProgress = null;
          return;
        }
        if (unitOfWork.flags & 32768) {
          if (isHydrating || 1 === suspendedReason) root2 = true;
          else if (workInProgressRootIsPrerendering || 0 !== (workInProgressRootRenderLanes & 536870912))
            root2 = false;
          else if (workInProgressRootDidSkipSuspendedSiblings = root2 = true, 2 === suspendedReason || 9 === suspendedReason || 3 === suspendedReason || 6 === suspendedReason)
            suspendedReason = suspenseHandlerStackCursor.current, null !== suspendedReason && 13 === suspendedReason.tag && (suspendedReason.flags |= 16384);
          unwindUnitOfWork(unitOfWork, root2);
        } else completeUnitOfWork(unitOfWork);
      }
      function completeUnitOfWork(unitOfWork) {
        var completedWork = unitOfWork;
        do {
          if (0 !== (completedWork.flags & 32768)) {
            unwindUnitOfWork(
              completedWork,
              workInProgressRootDidSkipSuspendedSiblings
            );
            return;
          }
          unitOfWork = completedWork.return;
          var next = completeWork(
            completedWork.alternate,
            completedWork,
            entangledRenderLanes
          );
          if (null !== next) {
            workInProgress = next;
            return;
          }
          completedWork = completedWork.sibling;
          if (null !== completedWork) {
            workInProgress = completedWork;
            return;
          }
          workInProgress = completedWork = unitOfWork;
        } while (null !== completedWork);
        0 === workInProgressRootExitStatus && (workInProgressRootExitStatus = 5);
      }
      function unwindUnitOfWork(unitOfWork, skipSiblings) {
        do {
          var next = unwindWork(unitOfWork.alternate, unitOfWork);
          if (null !== next) {
            next.flags &= 32767;
            workInProgress = next;
            return;
          }
          next = unitOfWork.return;
          null !== next && (next.flags |= 32768, next.subtreeFlags = 0, next.deletions = null);
          if (!skipSiblings && (unitOfWork = unitOfWork.sibling, null !== unitOfWork)) {
            workInProgress = unitOfWork;
            return;
          }
          workInProgress = unitOfWork = next;
        } while (null !== unitOfWork);
        workInProgressRootExitStatus = 6;
        workInProgress = null;
      }
      function commitRoot(root2, finishedWork, lanes, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, spawnedLane, updatedLanes, suspendedRetryLanes) {
        root2.cancelPendingCommit = null;
        do
          flushPendingEffects();
        while (0 !== pendingEffectsStatus);
        if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(327));
        if (null !== finishedWork) {
          if (finishedWork === root2.current) throw Error(formatProdErrorMessage(177));
          didIncludeRenderPhaseUpdate = finishedWork.lanes | finishedWork.childLanes;
          didIncludeRenderPhaseUpdate |= concurrentlyUpdatedLanes;
          markRootFinished(
            root2,
            lanes,
            didIncludeRenderPhaseUpdate,
            spawnedLane,
            updatedLanes,
            suspendedRetryLanes
          );
          root2 === workInProgressRoot && (workInProgress = workInProgressRoot = null, workInProgressRootRenderLanes = 0);
          pendingFinishedWork = finishedWork;
          pendingEffectsRoot = root2;
          pendingEffectsLanes = lanes;
          pendingEffectsRemainingLanes = didIncludeRenderPhaseUpdate;
          pendingPassiveTransitions = transitions;
          pendingRecoverableErrors = recoverableErrors;
          0 !== (finishedWork.subtreeFlags & 10256) || 0 !== (finishedWork.flags & 10256) ? (root2.callbackNode = null, root2.callbackPriority = 0, scheduleCallback$1(NormalPriority$1, function() {
            flushPassiveEffects(true);
            return null;
          })) : (root2.callbackNode = null, root2.callbackPriority = 0);
          recoverableErrors = 0 !== (finishedWork.flags & 13878);
          if (0 !== (finishedWork.subtreeFlags & 13878) || recoverableErrors) {
            recoverableErrors = ReactSharedInternals.T;
            ReactSharedInternals.T = null;
            transitions = ReactDOMSharedInternals.p;
            ReactDOMSharedInternals.p = 2;
            spawnedLane = executionContext;
            executionContext |= 4;
            try {
              commitBeforeMutationEffects(root2, finishedWork, lanes);
            } finally {
              executionContext = spawnedLane, ReactDOMSharedInternals.p = transitions, ReactSharedInternals.T = recoverableErrors;
            }
          }
          pendingEffectsStatus = 1;
          flushMutationEffects();
          flushLayoutEffects();
          flushSpawnedWork();
        }
      }
      function flushMutationEffects() {
        if (1 === pendingEffectsStatus) {
          pendingEffectsStatus = 0;
          var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, rootMutationHasEffect = 0 !== (finishedWork.flags & 13878);
          if (0 !== (finishedWork.subtreeFlags & 13878) || rootMutationHasEffect) {
            rootMutationHasEffect = ReactSharedInternals.T;
            ReactSharedInternals.T = null;
            var previousPriority = ReactDOMSharedInternals.p;
            ReactDOMSharedInternals.p = 2;
            var prevExecutionContext = executionContext;
            executionContext |= 4;
            try {
              commitMutationEffectsOnFiber(finishedWork, root2);
              var priorSelectionInformation = selectionInformation, curFocusedElem = getActiveElementDeep(root2.containerInfo), priorFocusedElem = priorSelectionInformation.focusedElem, priorSelectionRange = priorSelectionInformation.selectionRange;
              if (curFocusedElem !== priorFocusedElem && priorFocusedElem && priorFocusedElem.ownerDocument && containsNode(
                priorFocusedElem.ownerDocument.documentElement,
                priorFocusedElem
              )) {
                if (null !== priorSelectionRange && hasSelectionCapabilities(priorFocusedElem)) {
                  var start = priorSelectionRange.start, end = priorSelectionRange.end;
                  void 0 === end && (end = start);
                  if ("selectionStart" in priorFocusedElem)
                    priorFocusedElem.selectionStart = start, priorFocusedElem.selectionEnd = Math.min(
                      end,
                      priorFocusedElem.value.length
                    );
                  else {
                    var doc = priorFocusedElem.ownerDocument || document, win = doc && doc.defaultView || window;
                    if (win.getSelection) {
                      var selection = win.getSelection(), length = priorFocusedElem.textContent.length, start$jscomp$0 = Math.min(priorSelectionRange.start, length), end$jscomp$0 = void 0 === priorSelectionRange.end ? start$jscomp$0 : Math.min(priorSelectionRange.end, length);
                      !selection.extend && start$jscomp$0 > end$jscomp$0 && (curFocusedElem = end$jscomp$0, end$jscomp$0 = start$jscomp$0, start$jscomp$0 = curFocusedElem);
                      var startMarker = getNodeForCharacterOffset(
                        priorFocusedElem,
                        start$jscomp$0
                      ), endMarker = getNodeForCharacterOffset(
                        priorFocusedElem,
                        end$jscomp$0
                      );
                      if (startMarker && endMarker && (1 !== selection.rangeCount || selection.anchorNode !== startMarker.node || selection.anchorOffset !== startMarker.offset || selection.focusNode !== endMarker.node || selection.focusOffset !== endMarker.offset)) {
                        var range = doc.createRange();
                        range.setStart(startMarker.node, startMarker.offset);
                        selection.removeAllRanges();
                        start$jscomp$0 > end$jscomp$0 ? (selection.addRange(range), selection.extend(endMarker.node, endMarker.offset)) : (range.setEnd(endMarker.node, endMarker.offset), selection.addRange(range));
                      }
                    }
                  }
                }
                doc = [];
                for (selection = priorFocusedElem; selection = selection.parentNode; )
                  1 === selection.nodeType && doc.push({
                    element: selection,
                    left: selection.scrollLeft,
                    top: selection.scrollTop
                  });
                "function" === typeof priorFocusedElem.focus && priorFocusedElem.focus();
                for (priorFocusedElem = 0; priorFocusedElem < doc.length; priorFocusedElem++) {
                  var info = doc[priorFocusedElem];
                  info.element.scrollLeft = info.left;
                  info.element.scrollTop = info.top;
                }
              }
              _enabled = !!eventsEnabled;
              selectionInformation = eventsEnabled = null;
            } finally {
              executionContext = prevExecutionContext, ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = rootMutationHasEffect;
            }
          }
          root2.current = finishedWork;
          pendingEffectsStatus = 2;
        }
      }
      function flushLayoutEffects() {
        if (2 === pendingEffectsStatus) {
          pendingEffectsStatus = 0;
          var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, rootHasLayoutEffect = 0 !== (finishedWork.flags & 8772);
          if (0 !== (finishedWork.subtreeFlags & 8772) || rootHasLayoutEffect) {
            rootHasLayoutEffect = ReactSharedInternals.T;
            ReactSharedInternals.T = null;
            var previousPriority = ReactDOMSharedInternals.p;
            ReactDOMSharedInternals.p = 2;
            var prevExecutionContext = executionContext;
            executionContext |= 4;
            try {
              commitLayoutEffectOnFiber(root2, finishedWork.alternate, finishedWork);
            } finally {
              executionContext = prevExecutionContext, ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = rootHasLayoutEffect;
            }
          }
          pendingEffectsStatus = 3;
        }
      }
      function flushSpawnedWork() {
        if (4 === pendingEffectsStatus || 3 === pendingEffectsStatus) {
          pendingEffectsStatus = 0;
          requestPaint();
          var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, lanes = pendingEffectsLanes, recoverableErrors = pendingRecoverableErrors;
          0 !== (finishedWork.subtreeFlags & 10256) || 0 !== (finishedWork.flags & 10256) ? pendingEffectsStatus = 5 : (pendingEffectsStatus = 0, pendingFinishedWork = pendingEffectsRoot = null, releaseRootPooledCache(root2, root2.pendingLanes));
          var remainingLanes = root2.pendingLanes;
          0 === remainingLanes && (legacyErrorBoundariesThatAlreadyFailed = null);
          lanesToEventPriority(lanes);
          finishedWork = finishedWork.stateNode;
          if (injectedHook && "function" === typeof injectedHook.onCommitFiberRoot)
            try {
              injectedHook.onCommitFiberRoot(
                rendererID,
                finishedWork,
                void 0,
                128 === (finishedWork.current.flags & 128)
              );
            } catch (err) {
            }
          if (null !== recoverableErrors) {
            finishedWork = ReactSharedInternals.T;
            remainingLanes = ReactDOMSharedInternals.p;
            ReactDOMSharedInternals.p = 2;
            ReactSharedInternals.T = null;
            try {
              for (var onRecoverableError = root2.onRecoverableError, i = 0; i < recoverableErrors.length; i++) {
                var recoverableError = recoverableErrors[i];
                onRecoverableError(recoverableError.value, {
                  componentStack: recoverableError.stack
                });
              }
            } finally {
              ReactSharedInternals.T = finishedWork, ReactDOMSharedInternals.p = remainingLanes;
            }
          }
          0 !== (pendingEffectsLanes & 3) && flushPendingEffects();
          ensureRootIsScheduled(root2);
          remainingLanes = root2.pendingLanes;
          0 !== (lanes & 4194090) && 0 !== (remainingLanes & 42) ? root2 === rootWithNestedUpdates ? nestedUpdateCount++ : (nestedUpdateCount = 0, rootWithNestedUpdates = root2) : nestedUpdateCount = 0;
          flushSyncWorkAcrossRoots_impl(0, false);
        }
      }
      function releaseRootPooledCache(root2, remainingLanes) {
        0 === (root2.pooledCacheLanes &= remainingLanes) && (remainingLanes = root2.pooledCache, null != remainingLanes && (root2.pooledCache = null, releaseCache(remainingLanes)));
      }
      function flushPendingEffects(wasDelayedCommit) {
        flushMutationEffects();
        flushLayoutEffects();
        flushSpawnedWork();
        return flushPassiveEffects(wasDelayedCommit);
      }
      function flushPassiveEffects() {
        if (5 !== pendingEffectsStatus) return false;
        var root2 = pendingEffectsRoot, remainingLanes = pendingEffectsRemainingLanes;
        pendingEffectsRemainingLanes = 0;
        var renderPriority = lanesToEventPriority(pendingEffectsLanes), prevTransition = ReactSharedInternals.T, previousPriority = ReactDOMSharedInternals.p;
        try {
          ReactDOMSharedInternals.p = 32 > renderPriority ? 32 : renderPriority;
          ReactSharedInternals.T = null;
          renderPriority = pendingPassiveTransitions;
          pendingPassiveTransitions = null;
          var root$jscomp$0 = pendingEffectsRoot, lanes = pendingEffectsLanes;
          pendingEffectsStatus = 0;
          pendingFinishedWork = pendingEffectsRoot = null;
          pendingEffectsLanes = 0;
          if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(331));
          var prevExecutionContext = executionContext;
          executionContext |= 4;
          commitPassiveUnmountOnFiber(root$jscomp$0.current);
          commitPassiveMountOnFiber(
            root$jscomp$0,
            root$jscomp$0.current,
            lanes,
            renderPriority
          );
          executionContext = prevExecutionContext;
          flushSyncWorkAcrossRoots_impl(0, false);
          if (injectedHook && "function" === typeof injectedHook.onPostCommitFiberRoot)
            try {
              injectedHook.onPostCommitFiberRoot(rendererID, root$jscomp$0);
            } catch (err) {
            }
          return true;
        } finally {
          ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition, releaseRootPooledCache(root2, remainingLanes);
        }
      }
      function captureCommitPhaseErrorOnRoot(rootFiber, sourceFiber, error) {
        sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
        sourceFiber = createRootErrorUpdate(rootFiber.stateNode, sourceFiber, 2);
        rootFiber = enqueueUpdate(rootFiber, sourceFiber, 2);
        null !== rootFiber && (markRootUpdated$1(rootFiber, 2), ensureRootIsScheduled(rootFiber));
      }
      function captureCommitPhaseError(sourceFiber, nearestMountedAncestor, error) {
        if (3 === sourceFiber.tag)
          captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error);
        else
          for (; null !== nearestMountedAncestor; ) {
            if (3 === nearestMountedAncestor.tag) {
              captureCommitPhaseErrorOnRoot(
                nearestMountedAncestor,
                sourceFiber,
                error
              );
              break;
            } else if (1 === nearestMountedAncestor.tag) {
              var instance = nearestMountedAncestor.stateNode;
              if ("function" === typeof nearestMountedAncestor.type.getDerivedStateFromError || "function" === typeof instance.componentDidCatch && (null === legacyErrorBoundariesThatAlreadyFailed || !legacyErrorBoundariesThatAlreadyFailed.has(instance))) {
                sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
                error = createClassErrorUpdate(2);
                instance = enqueueUpdate(nearestMountedAncestor, error, 2);
                null !== instance && (initializeClassErrorUpdate(
                  error,
                  instance,
                  nearestMountedAncestor,
                  sourceFiber
                ), markRootUpdated$1(instance, 2), ensureRootIsScheduled(instance));
                break;
              }
            }
            nearestMountedAncestor = nearestMountedAncestor.return;
          }
      }
      function attachPingListener(root2, wakeable, lanes) {
        var pingCache = root2.pingCache;
        if (null === pingCache) {
          pingCache = root2.pingCache = new PossiblyWeakMap();
          var threadIDs = /* @__PURE__ */ new Set();
          pingCache.set(wakeable, threadIDs);
        } else
          threadIDs = pingCache.get(wakeable), void 0 === threadIDs && (threadIDs = /* @__PURE__ */ new Set(), pingCache.set(wakeable, threadIDs));
        threadIDs.has(lanes) || (workInProgressRootDidAttachPingListener = true, threadIDs.add(lanes), root2 = pingSuspendedRoot.bind(null, root2, wakeable, lanes), wakeable.then(root2, root2));
      }
      function pingSuspendedRoot(root2, wakeable, pingedLanes) {
        var pingCache = root2.pingCache;
        null !== pingCache && pingCache.delete(wakeable);
        root2.pingedLanes |= root2.suspendedLanes & pingedLanes;
        root2.warmLanes &= ~pingedLanes;
        workInProgressRoot === root2 && (workInProgressRootRenderLanes & pingedLanes) === pingedLanes && (4 === workInProgressRootExitStatus || 3 === workInProgressRootExitStatus && (workInProgressRootRenderLanes & 62914560) === workInProgressRootRenderLanes && 300 > now() - globalMostRecentFallbackTime ? 0 === (executionContext & 2) && prepareFreshStack(root2, 0) : workInProgressRootPingedLanes |= pingedLanes, workInProgressSuspendedRetryLanes === workInProgressRootRenderLanes && (workInProgressSuspendedRetryLanes = 0));
        ensureRootIsScheduled(root2);
      }
      function retryTimedOutBoundary(boundaryFiber, retryLane) {
        0 === retryLane && (retryLane = claimNextRetryLane());
        boundaryFiber = enqueueConcurrentRenderForLane(boundaryFiber, retryLane);
        null !== boundaryFiber && (markRootUpdated$1(boundaryFiber, retryLane), ensureRootIsScheduled(boundaryFiber));
      }
      function retryDehydratedSuspenseBoundary(boundaryFiber) {
        var suspenseState = boundaryFiber.memoizedState, retryLane = 0;
        null !== suspenseState && (retryLane = suspenseState.retryLane);
        retryTimedOutBoundary(boundaryFiber, retryLane);
      }
      function resolveRetryWakeable(boundaryFiber, wakeable) {
        var retryLane = 0;
        switch (boundaryFiber.tag) {
          case 13:
            var retryCache = boundaryFiber.stateNode;
            var suspenseState = boundaryFiber.memoizedState;
            null !== suspenseState && (retryLane = suspenseState.retryLane);
            break;
          case 19:
            retryCache = boundaryFiber.stateNode;
            break;
          case 22:
            retryCache = boundaryFiber.stateNode._retryCache;
            break;
          default:
            throw Error(formatProdErrorMessage(314));
        }
        null !== retryCache && retryCache.delete(wakeable);
        retryTimedOutBoundary(boundaryFiber, retryLane);
      }
      function scheduleCallback$1(priorityLevel, callback) {
        return scheduleCallback$3(priorityLevel, callback);
      }
      var firstScheduledRoot = null;
      var lastScheduledRoot = null;
      var didScheduleMicrotask = false;
      var mightHavePendingSyncWork = false;
      var isFlushingWork = false;
      var currentEventTransitionLane = 0;
      function ensureRootIsScheduled(root2) {
        root2 !== lastScheduledRoot && null === root2.next && (null === lastScheduledRoot ? firstScheduledRoot = lastScheduledRoot = root2 : lastScheduledRoot = lastScheduledRoot.next = root2);
        mightHavePendingSyncWork = true;
        didScheduleMicrotask || (didScheduleMicrotask = true, scheduleImmediateRootScheduleTask());
      }
      function flushSyncWorkAcrossRoots_impl(syncTransitionLanes, onlyLegacy) {
        if (!isFlushingWork && mightHavePendingSyncWork) {
          isFlushingWork = true;
          do {
            var didPerformSomeWork = false;
            for (var root$174 = firstScheduledRoot; null !== root$174; ) {
              if (!onlyLegacy)
                if (0 !== syncTransitionLanes) {
                  var pendingLanes = root$174.pendingLanes;
                  if (0 === pendingLanes) var JSCompiler_inline_result = 0;
                  else {
                    var suspendedLanes = root$174.suspendedLanes, pingedLanes = root$174.pingedLanes;
                    JSCompiler_inline_result = (1 << 31 - clz32(42 | syncTransitionLanes) + 1) - 1;
                    JSCompiler_inline_result &= pendingLanes & ~(suspendedLanes & ~pingedLanes);
                    JSCompiler_inline_result = JSCompiler_inline_result & 201326741 ? JSCompiler_inline_result & 201326741 | 1 : JSCompiler_inline_result ? JSCompiler_inline_result | 2 : 0;
                  }
                  0 !== JSCompiler_inline_result && (didPerformSomeWork = true, performSyncWorkOnRoot(root$174, JSCompiler_inline_result));
                } else
                  JSCompiler_inline_result = workInProgressRootRenderLanes, JSCompiler_inline_result = getNextLanes(
                    root$174,
                    root$174 === workInProgressRoot ? JSCompiler_inline_result : 0,
                    null !== root$174.cancelPendingCommit || -1 !== root$174.timeoutHandle
                  ), 0 === (JSCompiler_inline_result & 3) || checkIfRootIsPrerendering(root$174, JSCompiler_inline_result) || (didPerformSomeWork = true, performSyncWorkOnRoot(root$174, JSCompiler_inline_result));
              root$174 = root$174.next;
            }
          } while (didPerformSomeWork);
          isFlushingWork = false;
        }
      }
      function processRootScheduleInImmediateTask() {
        processRootScheduleInMicrotask();
      }
      function processRootScheduleInMicrotask() {
        mightHavePendingSyncWork = didScheduleMicrotask = false;
        var syncTransitionLanes = 0;
        0 !== currentEventTransitionLane && (shouldAttemptEagerTransition() && (syncTransitionLanes = currentEventTransitionLane), currentEventTransitionLane = 0);
        for (var currentTime = now(), prev = null, root2 = firstScheduledRoot; null !== root2; ) {
          var next = root2.next, nextLanes = scheduleTaskForRootDuringMicrotask(root2, currentTime);
          if (0 === nextLanes)
            root2.next = null, null === prev ? firstScheduledRoot = next : prev.next = next, null === next && (lastScheduledRoot = prev);
          else if (prev = root2, 0 !== syncTransitionLanes || 0 !== (nextLanes & 3))
            mightHavePendingSyncWork = true;
          root2 = next;
        }
        flushSyncWorkAcrossRoots_impl(syncTransitionLanes, false);
      }
      function scheduleTaskForRootDuringMicrotask(root2, currentTime) {
        for (var suspendedLanes = root2.suspendedLanes, pingedLanes = root2.pingedLanes, expirationTimes = root2.expirationTimes, lanes = root2.pendingLanes & -62914561; 0 < lanes; ) {
          var index$3 = 31 - clz32(lanes), lane = 1 << index$3, expirationTime = expirationTimes[index$3];
          if (-1 === expirationTime) {
            if (0 === (lane & suspendedLanes) || 0 !== (lane & pingedLanes))
              expirationTimes[index$3] = computeExpirationTime(lane, currentTime);
          } else expirationTime <= currentTime && (root2.expiredLanes |= lane);
          lanes &= ~lane;
        }
        currentTime = workInProgressRoot;
        suspendedLanes = workInProgressRootRenderLanes;
        suspendedLanes = getNextLanes(
          root2,
          root2 === currentTime ? suspendedLanes : 0,
          null !== root2.cancelPendingCommit || -1 !== root2.timeoutHandle
        );
        pingedLanes = root2.callbackNode;
        if (0 === suspendedLanes || root2 === currentTime && (2 === workInProgressSuspendedReason || 9 === workInProgressSuspendedReason) || null !== root2.cancelPendingCommit)
          return null !== pingedLanes && null !== pingedLanes && cancelCallback$1(pingedLanes), root2.callbackNode = null, root2.callbackPriority = 0;
        if (0 === (suspendedLanes & 3) || checkIfRootIsPrerendering(root2, suspendedLanes)) {
          currentTime = suspendedLanes & -suspendedLanes;
          if (currentTime === root2.callbackPriority) return currentTime;
          null !== pingedLanes && cancelCallback$1(pingedLanes);
          switch (lanesToEventPriority(suspendedLanes)) {
            case 2:
            case 8:
              suspendedLanes = UserBlockingPriority;
              break;
            case 32:
              suspendedLanes = NormalPriority$1;
              break;
            case 268435456:
              suspendedLanes = IdlePriority;
              break;
            default:
              suspendedLanes = NormalPriority$1;
          }
          pingedLanes = performWorkOnRootViaSchedulerTask.bind(null, root2);
          suspendedLanes = scheduleCallback$3(suspendedLanes, pingedLanes);
          root2.callbackPriority = currentTime;
          root2.callbackNode = suspendedLanes;
          return currentTime;
        }
        null !== pingedLanes && null !== pingedLanes && cancelCallback$1(pingedLanes);
        root2.callbackPriority = 2;
        root2.callbackNode = null;
        return 2;
      }
      function performWorkOnRootViaSchedulerTask(root2, didTimeout) {
        if (0 !== pendingEffectsStatus && 5 !== pendingEffectsStatus)
          return root2.callbackNode = null, root2.callbackPriority = 0, null;
        var originalCallbackNode = root2.callbackNode;
        if (flushPendingEffects(true) && root2.callbackNode !== originalCallbackNode)
          return null;
        var workInProgressRootRenderLanes$jscomp$0 = workInProgressRootRenderLanes;
        workInProgressRootRenderLanes$jscomp$0 = getNextLanes(
          root2,
          root2 === workInProgressRoot ? workInProgressRootRenderLanes$jscomp$0 : 0,
          null !== root2.cancelPendingCommit || -1 !== root2.timeoutHandle
        );
        if (0 === workInProgressRootRenderLanes$jscomp$0) return null;
        performWorkOnRoot(root2, workInProgressRootRenderLanes$jscomp$0, didTimeout);
        scheduleTaskForRootDuringMicrotask(root2, now());
        return null != root2.callbackNode && root2.callbackNode === originalCallbackNode ? performWorkOnRootViaSchedulerTask.bind(null, root2) : null;
      }
      function performSyncWorkOnRoot(root2, lanes) {
        if (flushPendingEffects()) return null;
        performWorkOnRoot(root2, lanes, true);
      }
      function scheduleImmediateRootScheduleTask() {
        scheduleMicrotask(function() {
          0 !== (executionContext & 6) ? scheduleCallback$3(
            ImmediatePriority,
            processRootScheduleInImmediateTask
          ) : processRootScheduleInMicrotask();
        });
      }
      function requestTransitionLane() {
        0 === currentEventTransitionLane && (currentEventTransitionLane = claimNextTransitionLane());
        return currentEventTransitionLane;
      }
      function coerceFormActionProp(actionProp) {
        return null == actionProp || "symbol" === typeof actionProp || "boolean" === typeof actionProp ? null : "function" === typeof actionProp ? actionProp : sanitizeURL("" + actionProp);
      }
      function createFormDataWithSubmitter(form, submitter) {
        var temp = submitter.ownerDocument.createElement("input");
        temp.name = submitter.name;
        temp.value = submitter.value;
        form.id && temp.setAttribute("form", form.id);
        submitter.parentNode.insertBefore(temp, submitter);
        form = new FormData(form);
        temp.parentNode.removeChild(temp);
        return form;
      }
      function extractEvents$1(dispatchQueue, domEventName, maybeTargetInst, nativeEvent, nativeEventTarget) {
        if ("submit" === domEventName && maybeTargetInst && maybeTargetInst.stateNode === nativeEventTarget) {
          var action = coerceFormActionProp(
            (nativeEventTarget[internalPropsKey] || null).action
          ), submitter = nativeEvent.submitter;
          submitter && (domEventName = (domEventName = submitter[internalPropsKey] || null) ? coerceFormActionProp(domEventName.formAction) : submitter.getAttribute("formAction"), null !== domEventName && (action = domEventName, submitter = null));
          var event = new SyntheticEvent(
            "action",
            "action",
            null,
            nativeEvent,
            nativeEventTarget
          );
          dispatchQueue.push({
            event,
            listeners: [
              {
                instance: null,
                listener: function() {
                  if (nativeEvent.defaultPrevented) {
                    if (0 !== currentEventTransitionLane) {
                      var formData = submitter ? createFormDataWithSubmitter(nativeEventTarget, submitter) : new FormData(nativeEventTarget);
                      startHostTransition(
                        maybeTargetInst,
                        {
                          pending: true,
                          data: formData,
                          method: nativeEventTarget.method,
                          action
                        },
                        null,
                        formData
                      );
                    }
                  } else
                    "function" === typeof action && (event.preventDefault(), formData = submitter ? createFormDataWithSubmitter(nativeEventTarget, submitter) : new FormData(nativeEventTarget), startHostTransition(
                      maybeTargetInst,
                      {
                        pending: true,
                        data: formData,
                        method: nativeEventTarget.method,
                        action
                      },
                      action,
                      formData
                    ));
                },
                currentTarget: nativeEventTarget
              }
            ]
          });
        }
      }
      for (i$jscomp$inline_1528 = 0; i$jscomp$inline_1528 < simpleEventPluginEvents.length; i$jscomp$inline_1528++) {
        eventName$jscomp$inline_1529 = simpleEventPluginEvents[i$jscomp$inline_1528], domEventName$jscomp$inline_1530 = eventName$jscomp$inline_1529.toLowerCase(), capitalizedEvent$jscomp$inline_1531 = eventName$jscomp$inline_1529[0].toUpperCase() + eventName$jscomp$inline_1529.slice(1);
        registerSimpleEvent(
          domEventName$jscomp$inline_1530,
          "on" + capitalizedEvent$jscomp$inline_1531
        );
      }
      var eventName$jscomp$inline_1529;
      var domEventName$jscomp$inline_1530;
      var capitalizedEvent$jscomp$inline_1531;
      var i$jscomp$inline_1528;
      registerSimpleEvent(ANIMATION_END, "onAnimationEnd");
      registerSimpleEvent(ANIMATION_ITERATION, "onAnimationIteration");
      registerSimpleEvent(ANIMATION_START, "onAnimationStart");
      registerSimpleEvent("dblclick", "onDoubleClick");
      registerSimpleEvent("focusin", "onFocus");
      registerSimpleEvent("focusout", "onBlur");
      registerSimpleEvent(TRANSITION_RUN, "onTransitionRun");
      registerSimpleEvent(TRANSITION_START, "onTransitionStart");
      registerSimpleEvent(TRANSITION_CANCEL, "onTransitionCancel");
      registerSimpleEvent(TRANSITION_END, "onTransitionEnd");
      registerDirectEvent("onMouseEnter", ["mouseout", "mouseover"]);
      registerDirectEvent("onMouseLeave", ["mouseout", "mouseover"]);
      registerDirectEvent("onPointerEnter", ["pointerout", "pointerover"]);
      registerDirectEvent("onPointerLeave", ["pointerout", "pointerover"]);
      registerTwoPhaseEvent(
        "onChange",
        "change click focusin focusout input keydown keyup selectionchange".split(" ")
      );
      registerTwoPhaseEvent(
        "onSelect",
        "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
          " "
        )
      );
      registerTwoPhaseEvent("onBeforeInput", [
        "compositionend",
        "keypress",
        "textInput",
        "paste"
      ]);
      registerTwoPhaseEvent(
        "onCompositionEnd",
        "compositionend focusout keydown keypress keyup mousedown".split(" ")
      );
      registerTwoPhaseEvent(
        "onCompositionStart",
        "compositionstart focusout keydown keypress keyup mousedown".split(" ")
      );
      registerTwoPhaseEvent(
        "onCompositionUpdate",
        "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
      );
      var mediaEventTypes = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
        " "
      );
      var nonDelegatedEvents = new Set(
        "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(mediaEventTypes)
      );
      function processDispatchQueue(dispatchQueue, eventSystemFlags) {
        eventSystemFlags = 0 !== (eventSystemFlags & 4);
        for (var i = 0; i < dispatchQueue.length; i++) {
          var _dispatchQueue$i = dispatchQueue[i], event = _dispatchQueue$i.event;
          _dispatchQueue$i = _dispatchQueue$i.listeners;
          a: {
            var previousInstance = void 0;
            if (eventSystemFlags)
              for (var i$jscomp$0 = _dispatchQueue$i.length - 1; 0 <= i$jscomp$0; i$jscomp$0--) {
                var _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0], instance = _dispatchListeners$i.instance, currentTarget = _dispatchListeners$i.currentTarget;
                _dispatchListeners$i = _dispatchListeners$i.listener;
                if (instance !== previousInstance && event.isPropagationStopped())
                  break a;
                previousInstance = _dispatchListeners$i;
                event.currentTarget = currentTarget;
                try {
                  previousInstance(event);
                } catch (error) {
                  reportGlobalError(error);
                }
                event.currentTarget = null;
                previousInstance = instance;
              }
            else
              for (i$jscomp$0 = 0; i$jscomp$0 < _dispatchQueue$i.length; i$jscomp$0++) {
                _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0];
                instance = _dispatchListeners$i.instance;
                currentTarget = _dispatchListeners$i.currentTarget;
                _dispatchListeners$i = _dispatchListeners$i.listener;
                if (instance !== previousInstance && event.isPropagationStopped())
                  break a;
                previousInstance = _dispatchListeners$i;
                event.currentTarget = currentTarget;
                try {
                  previousInstance(event);
                } catch (error) {
                  reportGlobalError(error);
                }
                event.currentTarget = null;
                previousInstance = instance;
              }
          }
        }
      }
      function listenToNonDelegatedEvent(domEventName, targetElement) {
        var JSCompiler_inline_result = targetElement[internalEventHandlersKey];
        void 0 === JSCompiler_inline_result && (JSCompiler_inline_result = targetElement[internalEventHandlersKey] = /* @__PURE__ */ new Set());
        var listenerSetKey = domEventName + "__bubble";
        JSCompiler_inline_result.has(listenerSetKey) || (addTrappedEventListener(targetElement, domEventName, 2, false), JSCompiler_inline_result.add(listenerSetKey));
      }
      function listenToNativeEvent(domEventName, isCapturePhaseListener, target) {
        var eventSystemFlags = 0;
        isCapturePhaseListener && (eventSystemFlags |= 4);
        addTrappedEventListener(
          target,
          domEventName,
          eventSystemFlags,
          isCapturePhaseListener
        );
      }
      var listeningMarker = "_reactListening" + Math.random().toString(36).slice(2);
      function listenToAllSupportedEvents(rootContainerElement) {
        if (!rootContainerElement[listeningMarker]) {
          rootContainerElement[listeningMarker] = true;
          allNativeEvents.forEach(function(domEventName) {
            "selectionchange" !== domEventName && (nonDelegatedEvents.has(domEventName) || listenToNativeEvent(domEventName, false, rootContainerElement), listenToNativeEvent(domEventName, true, rootContainerElement));
          });
          var ownerDocument = 9 === rootContainerElement.nodeType ? rootContainerElement : rootContainerElement.ownerDocument;
          null === ownerDocument || ownerDocument[listeningMarker] || (ownerDocument[listeningMarker] = true, listenToNativeEvent("selectionchange", false, ownerDocument));
        }
      }
      function addTrappedEventListener(targetContainer, domEventName, eventSystemFlags, isCapturePhaseListener) {
        switch (getEventPriority(domEventName)) {
          case 2:
            var listenerWrapper = dispatchDiscreteEvent;
            break;
          case 8:
            listenerWrapper = dispatchContinuousEvent;
            break;
          default:
            listenerWrapper = dispatchEvent;
        }
        eventSystemFlags = listenerWrapper.bind(
          null,
          domEventName,
          eventSystemFlags,
          targetContainer
        );
        listenerWrapper = void 0;
        !passiveBrowserEventsSupported || "touchstart" !== domEventName && "touchmove" !== domEventName && "wheel" !== domEventName || (listenerWrapper = true);
        isCapturePhaseListener ? void 0 !== listenerWrapper ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
          capture: true,
          passive: listenerWrapper
        }) : targetContainer.addEventListener(domEventName, eventSystemFlags, true) : void 0 !== listenerWrapper ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
          passive: listenerWrapper
        }) : targetContainer.addEventListener(domEventName, eventSystemFlags, false);
      }
      function dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, targetInst$jscomp$0, targetContainer) {
        var ancestorInst = targetInst$jscomp$0;
        if (0 === (eventSystemFlags & 1) && 0 === (eventSystemFlags & 2) && null !== targetInst$jscomp$0)
          a: for (; ; ) {
            if (null === targetInst$jscomp$0) return;
            var nodeTag = targetInst$jscomp$0.tag;
            if (3 === nodeTag || 4 === nodeTag) {
              var container = targetInst$jscomp$0.stateNode.containerInfo;
              if (container === targetContainer) break;
              if (4 === nodeTag)
                for (nodeTag = targetInst$jscomp$0.return; null !== nodeTag; ) {
                  var grandTag = nodeTag.tag;
                  if ((3 === grandTag || 4 === grandTag) && nodeTag.stateNode.containerInfo === targetContainer)
                    return;
                  nodeTag = nodeTag.return;
                }
              for (; null !== container; ) {
                nodeTag = getClosestInstanceFromNode(container);
                if (null === nodeTag) return;
                grandTag = nodeTag.tag;
                if (5 === grandTag || 6 === grandTag || 26 === grandTag || 27 === grandTag) {
                  targetInst$jscomp$0 = ancestorInst = nodeTag;
                  continue a;
                }
                container = container.parentNode;
              }
            }
            targetInst$jscomp$0 = targetInst$jscomp$0.return;
          }
        batchedUpdates$1(function() {
          var targetInst = ancestorInst, nativeEventTarget = getEventTarget(nativeEvent), dispatchQueue = [];
          a: {
            var reactName = topLevelEventsToReactNames.get(domEventName);
            if (void 0 !== reactName) {
              var SyntheticEventCtor = SyntheticEvent, reactEventType = domEventName;
              switch (domEventName) {
                case "keypress":
                  if (0 === getEventCharCode(nativeEvent)) break a;
                case "keydown":
                case "keyup":
                  SyntheticEventCtor = SyntheticKeyboardEvent;
                  break;
                case "focusin":
                  reactEventType = "focus";
                  SyntheticEventCtor = SyntheticFocusEvent;
                  break;
                case "focusout":
                  reactEventType = "blur";
                  SyntheticEventCtor = SyntheticFocusEvent;
                  break;
                case "beforeblur":
                case "afterblur":
                  SyntheticEventCtor = SyntheticFocusEvent;
                  break;
                case "click":
                  if (2 === nativeEvent.button) break a;
                case "auxclick":
                case "dblclick":
                case "mousedown":
                case "mousemove":
                case "mouseup":
                case "mouseout":
                case "mouseover":
                case "contextmenu":
                  SyntheticEventCtor = SyntheticMouseEvent;
                  break;
                case "drag":
                case "dragend":
                case "dragenter":
                case "dragexit":
                case "dragleave":
                case "dragover":
                case "dragstart":
                case "drop":
                  SyntheticEventCtor = SyntheticDragEvent;
                  break;
                case "touchcancel":
                case "touchend":
                case "touchmove":
                case "touchstart":
                  SyntheticEventCtor = SyntheticTouchEvent;
                  break;
                case ANIMATION_END:
                case ANIMATION_ITERATION:
                case ANIMATION_START:
                  SyntheticEventCtor = SyntheticAnimationEvent;
                  break;
                case TRANSITION_END:
                  SyntheticEventCtor = SyntheticTransitionEvent;
                  break;
                case "scroll":
                case "scrollend":
                  SyntheticEventCtor = SyntheticUIEvent;
                  break;
                case "wheel":
                  SyntheticEventCtor = SyntheticWheelEvent;
                  break;
                case "copy":
                case "cut":
                case "paste":
                  SyntheticEventCtor = SyntheticClipboardEvent;
                  break;
                case "gotpointercapture":
                case "lostpointercapture":
                case "pointercancel":
                case "pointerdown":
                case "pointermove":
                case "pointerout":
                case "pointerover":
                case "pointerup":
                  SyntheticEventCtor = SyntheticPointerEvent;
                  break;
                case "toggle":
                case "beforetoggle":
                  SyntheticEventCtor = SyntheticToggleEvent;
              }
              var inCapturePhase = 0 !== (eventSystemFlags & 4), accumulateTargetOnly = !inCapturePhase && ("scroll" === domEventName || "scrollend" === domEventName), reactEventName = inCapturePhase ? null !== reactName ? reactName + "Capture" : null : reactName;
              inCapturePhase = [];
              for (var instance = targetInst, lastHostComponent; null !== instance; ) {
                var _instance = instance;
                lastHostComponent = _instance.stateNode;
                _instance = _instance.tag;
                5 !== _instance && 26 !== _instance && 27 !== _instance || null === lastHostComponent || null === reactEventName || (_instance = getListener(instance, reactEventName), null != _instance && inCapturePhase.push(
                  createDispatchListener(instance, _instance, lastHostComponent)
                ));
                if (accumulateTargetOnly) break;
                instance = instance.return;
              }
              0 < inCapturePhase.length && (reactName = new SyntheticEventCtor(
                reactName,
                reactEventType,
                null,
                nativeEvent,
                nativeEventTarget
              ), dispatchQueue.push({ event: reactName, listeners: inCapturePhase }));
            }
          }
          if (0 === (eventSystemFlags & 7)) {
            a: {
              reactName = "mouseover" === domEventName || "pointerover" === domEventName;
              SyntheticEventCtor = "mouseout" === domEventName || "pointerout" === domEventName;
              if (reactName && nativeEvent !== currentReplayingEvent && (reactEventType = nativeEvent.relatedTarget || nativeEvent.fromElement) && (getClosestInstanceFromNode(reactEventType) || reactEventType[internalContainerInstanceKey]))
                break a;
              if (SyntheticEventCtor || reactName) {
                reactName = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget : (reactName = nativeEventTarget.ownerDocument) ? reactName.defaultView || reactName.parentWindow : window;
                if (SyntheticEventCtor) {
                  if (reactEventType = nativeEvent.relatedTarget || nativeEvent.toElement, SyntheticEventCtor = targetInst, reactEventType = reactEventType ? getClosestInstanceFromNode(reactEventType) : null, null !== reactEventType && (accumulateTargetOnly = getNearestMountedFiber(reactEventType), inCapturePhase = reactEventType.tag, reactEventType !== accumulateTargetOnly || 5 !== inCapturePhase && 27 !== inCapturePhase && 6 !== inCapturePhase))
                    reactEventType = null;
                } else SyntheticEventCtor = null, reactEventType = targetInst;
                if (SyntheticEventCtor !== reactEventType) {
                  inCapturePhase = SyntheticMouseEvent;
                  _instance = "onMouseLeave";
                  reactEventName = "onMouseEnter";
                  instance = "mouse";
                  if ("pointerout" === domEventName || "pointerover" === domEventName)
                    inCapturePhase = SyntheticPointerEvent, _instance = "onPointerLeave", reactEventName = "onPointerEnter", instance = "pointer";
                  accumulateTargetOnly = null == SyntheticEventCtor ? reactName : getNodeFromInstance(SyntheticEventCtor);
                  lastHostComponent = null == reactEventType ? reactName : getNodeFromInstance(reactEventType);
                  reactName = new inCapturePhase(
                    _instance,
                    instance + "leave",
                    SyntheticEventCtor,
                    nativeEvent,
                    nativeEventTarget
                  );
                  reactName.target = accumulateTargetOnly;
                  reactName.relatedTarget = lastHostComponent;
                  _instance = null;
                  getClosestInstanceFromNode(nativeEventTarget) === targetInst && (inCapturePhase = new inCapturePhase(
                    reactEventName,
                    instance + "enter",
                    reactEventType,
                    nativeEvent,
                    nativeEventTarget
                  ), inCapturePhase.target = lastHostComponent, inCapturePhase.relatedTarget = accumulateTargetOnly, _instance = inCapturePhase);
                  accumulateTargetOnly = _instance;
                  if (SyntheticEventCtor && reactEventType)
                    b: {
                      inCapturePhase = SyntheticEventCtor;
                      reactEventName = reactEventType;
                      instance = 0;
                      for (lastHostComponent = inCapturePhase; lastHostComponent; lastHostComponent = getParent(lastHostComponent))
                        instance++;
                      lastHostComponent = 0;
                      for (_instance = reactEventName; _instance; _instance = getParent(_instance))
                        lastHostComponent++;
                      for (; 0 < instance - lastHostComponent; )
                        inCapturePhase = getParent(inCapturePhase), instance--;
                      for (; 0 < lastHostComponent - instance; )
                        reactEventName = getParent(reactEventName), lastHostComponent--;
                      for (; instance--; ) {
                        if (inCapturePhase === reactEventName || null !== reactEventName && inCapturePhase === reactEventName.alternate)
                          break b;
                        inCapturePhase = getParent(inCapturePhase);
                        reactEventName = getParent(reactEventName);
                      }
                      inCapturePhase = null;
                    }
                  else inCapturePhase = null;
                  null !== SyntheticEventCtor && accumulateEnterLeaveListenersForEvent(
                    dispatchQueue,
                    reactName,
                    SyntheticEventCtor,
                    inCapturePhase,
                    false
                  );
                  null !== reactEventType && null !== accumulateTargetOnly && accumulateEnterLeaveListenersForEvent(
                    dispatchQueue,
                    accumulateTargetOnly,
                    reactEventType,
                    inCapturePhase,
                    true
                  );
                }
              }
            }
            a: {
              reactName = targetInst ? getNodeFromInstance(targetInst) : window;
              SyntheticEventCtor = reactName.nodeName && reactName.nodeName.toLowerCase();
              if ("select" === SyntheticEventCtor || "input" === SyntheticEventCtor && "file" === reactName.type)
                var getTargetInstFunc = getTargetInstForChangeEvent;
              else if (isTextInputElement(reactName))
                if (isInputEventSupported)
                  getTargetInstFunc = getTargetInstForInputOrChangeEvent;
                else {
                  getTargetInstFunc = getTargetInstForInputEventPolyfill;
                  var handleEventFunc = handleEventsForInputEventPolyfill;
                }
              else
                SyntheticEventCtor = reactName.nodeName, !SyntheticEventCtor || "input" !== SyntheticEventCtor.toLowerCase() || "checkbox" !== reactName.type && "radio" !== reactName.type ? targetInst && isCustomElement(targetInst.elementType) && (getTargetInstFunc = getTargetInstForChangeEvent) : getTargetInstFunc = getTargetInstForClickEvent;
              if (getTargetInstFunc && (getTargetInstFunc = getTargetInstFunc(domEventName, targetInst))) {
                createAndAccumulateChangeEvent(
                  dispatchQueue,
                  getTargetInstFunc,
                  nativeEvent,
                  nativeEventTarget
                );
                break a;
              }
              handleEventFunc && handleEventFunc(domEventName, reactName, targetInst);
              "focusout" === domEventName && targetInst && "number" === reactName.type && null != targetInst.memoizedProps.value && setDefaultValue(reactName, "number", reactName.value);
            }
            handleEventFunc = targetInst ? getNodeFromInstance(targetInst) : window;
            switch (domEventName) {
              case "focusin":
                if (isTextInputElement(handleEventFunc) || "true" === handleEventFunc.contentEditable)
                  activeElement = handleEventFunc, activeElementInst = targetInst, lastSelection = null;
                break;
              case "focusout":
                lastSelection = activeElementInst = activeElement = null;
                break;
              case "mousedown":
                mouseDown = true;
                break;
              case "contextmenu":
              case "mouseup":
              case "dragend":
                mouseDown = false;
                constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
                break;
              case "selectionchange":
                if (skipSelectionChangeEvent) break;
              case "keydown":
              case "keyup":
                constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
            }
            var fallbackData;
            if (canUseCompositionEvent)
              b: {
                switch (domEventName) {
                  case "compositionstart":
                    var eventType = "onCompositionStart";
                    break b;
                  case "compositionend":
                    eventType = "onCompositionEnd";
                    break b;
                  case "compositionupdate":
                    eventType = "onCompositionUpdate";
                    break b;
                }
                eventType = void 0;
              }
            else
              isComposing ? isFallbackCompositionEnd(domEventName, nativeEvent) && (eventType = "onCompositionEnd") : "keydown" === domEventName && 229 === nativeEvent.keyCode && (eventType = "onCompositionStart");
            eventType && (useFallbackCompositionData && "ko" !== nativeEvent.locale && (isComposing || "onCompositionStart" !== eventType ? "onCompositionEnd" === eventType && isComposing && (fallbackData = getData()) : (root = nativeEventTarget, startText = "value" in root ? root.value : root.textContent, isComposing = true)), handleEventFunc = accumulateTwoPhaseListeners(targetInst, eventType), 0 < handleEventFunc.length && (eventType = new SyntheticCompositionEvent(
              eventType,
              domEventName,
              null,
              nativeEvent,
              nativeEventTarget
            ), dispatchQueue.push({ event: eventType, listeners: handleEventFunc }), fallbackData ? eventType.data = fallbackData : (fallbackData = getDataFromCustomEvent(nativeEvent), null !== fallbackData && (eventType.data = fallbackData))));
            if (fallbackData = canUseTextInputEvent ? getNativeBeforeInputChars(domEventName, nativeEvent) : getFallbackBeforeInputChars(domEventName, nativeEvent))
              eventType = accumulateTwoPhaseListeners(targetInst, "onBeforeInput"), 0 < eventType.length && (handleEventFunc = new SyntheticCompositionEvent(
                "onBeforeInput",
                "beforeinput",
                null,
                nativeEvent,
                nativeEventTarget
              ), dispatchQueue.push({
                event: handleEventFunc,
                listeners: eventType
              }), handleEventFunc.data = fallbackData);
            extractEvents$1(
              dispatchQueue,
              domEventName,
              targetInst,
              nativeEvent,
              nativeEventTarget
            );
          }
          processDispatchQueue(dispatchQueue, eventSystemFlags);
        });
      }
      function createDispatchListener(instance, listener, currentTarget) {
        return {
          instance,
          listener,
          currentTarget
        };
      }
      function accumulateTwoPhaseListeners(targetFiber, reactName) {
        for (var captureName = reactName + "Capture", listeners3 = []; null !== targetFiber; ) {
          var _instance2 = targetFiber, stateNode = _instance2.stateNode;
          _instance2 = _instance2.tag;
          5 !== _instance2 && 26 !== _instance2 && 27 !== _instance2 || null === stateNode || (_instance2 = getListener(targetFiber, captureName), null != _instance2 && listeners3.unshift(
            createDispatchListener(targetFiber, _instance2, stateNode)
          ), _instance2 = getListener(targetFiber, reactName), null != _instance2 && listeners3.push(
            createDispatchListener(targetFiber, _instance2, stateNode)
          ));
          if (3 === targetFiber.tag) return listeners3;
          targetFiber = targetFiber.return;
        }
        return [];
      }
      function getParent(inst) {
        if (null === inst) return null;
        do
          inst = inst.return;
        while (inst && 5 !== inst.tag && 27 !== inst.tag);
        return inst ? inst : null;
      }
      function accumulateEnterLeaveListenersForEvent(dispatchQueue, event, target, common, inCapturePhase) {
        for (var registrationName = event._reactName, listeners3 = []; null !== target && target !== common; ) {
          var _instance3 = target, alternate = _instance3.alternate, stateNode = _instance3.stateNode;
          _instance3 = _instance3.tag;
          if (null !== alternate && alternate === common) break;
          5 !== _instance3 && 26 !== _instance3 && 27 !== _instance3 || null === stateNode || (alternate = stateNode, inCapturePhase ? (stateNode = getListener(target, registrationName), null != stateNode && listeners3.unshift(
            createDispatchListener(target, stateNode, alternate)
          )) : inCapturePhase || (stateNode = getListener(target, registrationName), null != stateNode && listeners3.push(
            createDispatchListener(target, stateNode, alternate)
          )));
          target = target.return;
        }
        0 !== listeners3.length && dispatchQueue.push({ event, listeners: listeners3 });
      }
      var NORMALIZE_NEWLINES_REGEX = /\r\n?/g;
      var NORMALIZE_NULL_AND_REPLACEMENT_REGEX = /\u0000|\uFFFD/g;
      function normalizeMarkupForTextOrAttribute(markup) {
        return ("string" === typeof markup ? markup : "" + markup).replace(NORMALIZE_NEWLINES_REGEX, "\n").replace(NORMALIZE_NULL_AND_REPLACEMENT_REGEX, "");
      }
      function checkForUnmatchedText(serverText, clientText) {
        clientText = normalizeMarkupForTextOrAttribute(clientText);
        return normalizeMarkupForTextOrAttribute(serverText) === clientText ? true : false;
      }
      function noop$1() {
      }
      function setProp(domElement, tag, key, value, props, prevValue) {
        switch (key) {
          case "children":
            "string" === typeof value ? "body" === tag || "textarea" === tag && "" === value || setTextContent(domElement, value) : ("number" === typeof value || "bigint" === typeof value) && "body" !== tag && setTextContent(domElement, "" + value);
            break;
          case "className":
            setValueForKnownAttribute(domElement, "class", value);
            break;
          case "tabIndex":
            setValueForKnownAttribute(domElement, "tabindex", value);
            break;
          case "dir":
          case "role":
          case "viewBox":
          case "width":
          case "height":
            setValueForKnownAttribute(domElement, key, value);
            break;
          case "style":
            setValueForStyles2(domElement, value, prevValue);
            break;
          case "data":
            if ("object" !== tag) {
              setValueForKnownAttribute(domElement, "data", value);
              break;
            }
          case "src":
          case "href":
            if ("" === value && ("a" !== tag || "href" !== key)) {
              domElement.removeAttribute(key);
              break;
            }
            if (null == value || "function" === typeof value || "symbol" === typeof value || "boolean" === typeof value) {
              domElement.removeAttribute(key);
              break;
            }
            value = sanitizeURL("" + value);
            domElement.setAttribute(key, value);
            break;
          case "action":
          case "formAction":
            if ("function" === typeof value) {
              domElement.setAttribute(
                key,
                "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
              );
              break;
            } else
              "function" === typeof prevValue && ("formAction" === key ? ("input" !== tag && setProp(domElement, tag, "name", props.name, props, null), setProp(
                domElement,
                tag,
                "formEncType",
                props.formEncType,
                props,
                null
              ), setProp(
                domElement,
                tag,
                "formMethod",
                props.formMethod,
                props,
                null
              ), setProp(
                domElement,
                tag,
                "formTarget",
                props.formTarget,
                props,
                null
              )) : (setProp(domElement, tag, "encType", props.encType, props, null), setProp(domElement, tag, "method", props.method, props, null), setProp(domElement, tag, "target", props.target, props, null)));
            if (null == value || "symbol" === typeof value || "boolean" === typeof value) {
              domElement.removeAttribute(key);
              break;
            }
            value = sanitizeURL("" + value);
            domElement.setAttribute(key, value);
            break;
          case "onClick":
            null != value && (domElement.onclick = noop$1);
            break;
          case "onScroll":
            null != value && listenToNonDelegatedEvent("scroll", domElement);
            break;
          case "onScrollEnd":
            null != value && listenToNonDelegatedEvent("scrollend", domElement);
            break;
          case "dangerouslySetInnerHTML":
            if (null != value) {
              if ("object" !== typeof value || !("__html" in value))
                throw Error(formatProdErrorMessage(61));
              key = value.__html;
              if (null != key) {
                if (null != props.children) throw Error(formatProdErrorMessage(60));
                domElement.innerHTML = key;
              }
            }
            break;
          case "multiple":
            domElement.multiple = value && "function" !== typeof value && "symbol" !== typeof value;
            break;
          case "muted":
            domElement.muted = value && "function" !== typeof value && "symbol" !== typeof value;
            break;
          case "suppressContentEditableWarning":
          case "suppressHydrationWarning":
          case "defaultValue":
          case "defaultChecked":
          case "innerHTML":
          case "ref":
            break;
          case "autoFocus":
            break;
          case "xlinkHref":
            if (null == value || "function" === typeof value || "boolean" === typeof value || "symbol" === typeof value) {
              domElement.removeAttribute("xlink:href");
              break;
            }
            key = sanitizeURL("" + value);
            domElement.setAttributeNS(
              "http://www.w3.org/1999/xlink",
              "xlink:href",
              key
            );
            break;
          case "contentEditable":
          case "spellCheck":
          case "draggable":
          case "value":
          case "autoReverse":
          case "externalResourcesRequired":
          case "focusable":
          case "preserveAlpha":
            null != value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, "" + value) : domElement.removeAttribute(key);
            break;
          case "inert":
          case "allowFullScreen":
          case "async":
          case "autoPlay":
          case "controls":
          case "default":
          case "defer":
          case "disabled":
          case "disablePictureInPicture":
          case "disableRemotePlayback":
          case "formNoValidate":
          case "hidden":
          case "loop":
          case "noModule":
          case "noValidate":
          case "open":
          case "playsInline":
          case "readOnly":
          case "required":
          case "reversed":
          case "scoped":
          case "seamless":
          case "itemScope":
            value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, "") : domElement.removeAttribute(key);
            break;
          case "capture":
          case "download":
            true === value ? domElement.setAttribute(key, "") : false !== value && null != value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
            break;
          case "cols":
          case "rows":
          case "size":
          case "span":
            null != value && "function" !== typeof value && "symbol" !== typeof value && !isNaN(value) && 1 <= value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
            break;
          case "rowSpan":
          case "start":
            null == value || "function" === typeof value || "symbol" === typeof value || isNaN(value) ? domElement.removeAttribute(key) : domElement.setAttribute(key, value);
            break;
          case "popover":
            listenToNonDelegatedEvent("beforetoggle", domElement);
            listenToNonDelegatedEvent("toggle", domElement);
            setValueForAttribute(domElement, "popover", value);
            break;
          case "xlinkActuate":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:actuate",
              value
            );
            break;
          case "xlinkArcrole":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:arcrole",
              value
            );
            break;
          case "xlinkRole":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:role",
              value
            );
            break;
          case "xlinkShow":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:show",
              value
            );
            break;
          case "xlinkTitle":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:title",
              value
            );
            break;
          case "xlinkType":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/1999/xlink",
              "xlink:type",
              value
            );
            break;
          case "xmlBase":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/XML/1998/namespace",
              "xml:base",
              value
            );
            break;
          case "xmlLang":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/XML/1998/namespace",
              "xml:lang",
              value
            );
            break;
          case "xmlSpace":
            setValueForNamespacedAttribute(
              domElement,
              "http://www.w3.org/XML/1998/namespace",
              "xml:space",
              value
            );
            break;
          case "is":
            setValueForAttribute(domElement, "is", value);
            break;
          case "innerText":
          case "textContent":
            break;
          default:
            if (!(2 < key.length) || "o" !== key[0] && "O" !== key[0] || "n" !== key[1] && "N" !== key[1])
              key = aliases.get(key) || key, setValueForAttribute(domElement, key, value);
        }
      }
      function setPropOnCustomElement(domElement, tag, key, value, props, prevValue) {
        switch (key) {
          case "style":
            setValueForStyles2(domElement, value, prevValue);
            break;
          case "dangerouslySetInnerHTML":
            if (null != value) {
              if ("object" !== typeof value || !("__html" in value))
                throw Error(formatProdErrorMessage(61));
              key = value.__html;
              if (null != key) {
                if (null != props.children) throw Error(formatProdErrorMessage(60));
                domElement.innerHTML = key;
              }
            }
            break;
          case "children":
            "string" === typeof value ? setTextContent(domElement, value) : ("number" === typeof value || "bigint" === typeof value) && setTextContent(domElement, "" + value);
            break;
          case "onScroll":
            null != value && listenToNonDelegatedEvent("scroll", domElement);
            break;
          case "onScrollEnd":
            null != value && listenToNonDelegatedEvent("scrollend", domElement);
            break;
          case "onClick":
            null != value && (domElement.onclick = noop$1);
            break;
          case "suppressContentEditableWarning":
          case "suppressHydrationWarning":
          case "innerHTML":
          case "ref":
            break;
          case "innerText":
          case "textContent":
            break;
          default:
            if (!registrationNameDependencies.hasOwnProperty(key))
              a: {
                if ("o" === key[0] && "n" === key[1] && (props = key.endsWith("Capture"), tag = key.slice(2, props ? key.length - 7 : void 0), prevValue = domElement[internalPropsKey] || null, prevValue = null != prevValue ? prevValue[key] : null, "function" === typeof prevValue && domElement.removeEventListener(tag, prevValue, props), "function" === typeof value)) {
                  "function" !== typeof prevValue && null !== prevValue && (key in domElement ? domElement[key] = null : domElement.hasAttribute(key) && domElement.removeAttribute(key));
                  domElement.addEventListener(tag, value, props);
                  break a;
                }
                key in domElement ? domElement[key] = value : true === value ? domElement.setAttribute(key, "") : setValueForAttribute(domElement, key, value);
              }
        }
      }
      function setInitialProperties(domElement, tag, props) {
        switch (tag) {
          case "div":
          case "span":
          case "svg":
          case "path":
          case "a":
          case "g":
          case "p":
          case "li":
            break;
          case "img":
            listenToNonDelegatedEvent("error", domElement);
            listenToNonDelegatedEvent("load", domElement);
            var hasSrc = false, hasSrcSet = false, propKey;
            for (propKey in props)
              if (props.hasOwnProperty(propKey)) {
                var propValue = props[propKey];
                if (null != propValue)
                  switch (propKey) {
                    case "src":
                      hasSrc = true;
                      break;
                    case "srcSet":
                      hasSrcSet = true;
                      break;
                    case "children":
                    case "dangerouslySetInnerHTML":
                      throw Error(formatProdErrorMessage(137, tag));
                    default:
                      setProp(domElement, tag, propKey, propValue, props, null);
                  }
              }
            hasSrcSet && setProp(domElement, tag, "srcSet", props.srcSet, props, null);
            hasSrc && setProp(domElement, tag, "src", props.src, props, null);
            return;
          case "input":
            listenToNonDelegatedEvent("invalid", domElement);
            var defaultValue = propKey = propValue = hasSrcSet = null, checked = null, defaultChecked = null;
            for (hasSrc in props)
              if (props.hasOwnProperty(hasSrc)) {
                var propValue$188 = props[hasSrc];
                if (null != propValue$188)
                  switch (hasSrc) {
                    case "name":
                      hasSrcSet = propValue$188;
                      break;
                    case "type":
                      propValue = propValue$188;
                      break;
                    case "checked":
                      checked = propValue$188;
                      break;
                    case "defaultChecked":
                      defaultChecked = propValue$188;
                      break;
                    case "value":
                      propKey = propValue$188;
                      break;
                    case "defaultValue":
                      defaultValue = propValue$188;
                      break;
                    case "children":
                    case "dangerouslySetInnerHTML":
                      if (null != propValue$188)
                        throw Error(formatProdErrorMessage(137, tag));
                      break;
                    default:
                      setProp(domElement, tag, hasSrc, propValue$188, props, null);
                  }
              }
            initInput(
              domElement,
              propKey,
              defaultValue,
              checked,
              defaultChecked,
              propValue,
              hasSrcSet,
              false
            );
            track(domElement);
            return;
          case "select":
            listenToNonDelegatedEvent("invalid", domElement);
            hasSrc = propValue = propKey = null;
            for (hasSrcSet in props)
              if (props.hasOwnProperty(hasSrcSet) && (defaultValue = props[hasSrcSet], null != defaultValue))
                switch (hasSrcSet) {
                  case "value":
                    propKey = defaultValue;
                    break;
                  case "defaultValue":
                    propValue = defaultValue;
                    break;
                  case "multiple":
                    hasSrc = defaultValue;
                  default:
                    setProp(domElement, tag, hasSrcSet, defaultValue, props, null);
                }
            tag = propKey;
            props = propValue;
            domElement.multiple = !!hasSrc;
            null != tag ? updateOptions(domElement, !!hasSrc, tag, false) : null != props && updateOptions(domElement, !!hasSrc, props, true);
            return;
          case "textarea":
            listenToNonDelegatedEvent("invalid", domElement);
            propKey = hasSrcSet = hasSrc = null;
            for (propValue in props)
              if (props.hasOwnProperty(propValue) && (defaultValue = props[propValue], null != defaultValue))
                switch (propValue) {
                  case "value":
                    hasSrc = defaultValue;
                    break;
                  case "defaultValue":
                    hasSrcSet = defaultValue;
                    break;
                  case "children":
                    propKey = defaultValue;
                    break;
                  case "dangerouslySetInnerHTML":
                    if (null != defaultValue) throw Error(formatProdErrorMessage(91));
                    break;
                  default:
                    setProp(domElement, tag, propValue, defaultValue, props, null);
                }
            initTextarea(domElement, hasSrc, hasSrcSet, propKey);
            track(domElement);
            return;
          case "option":
            for (checked in props)
              if (props.hasOwnProperty(checked) && (hasSrc = props[checked], null != hasSrc))
                switch (checked) {
                  case "selected":
                    domElement.selected = hasSrc && "function" !== typeof hasSrc && "symbol" !== typeof hasSrc;
                    break;
                  default:
                    setProp(domElement, tag, checked, hasSrc, props, null);
                }
            return;
          case "dialog":
            listenToNonDelegatedEvent("beforetoggle", domElement);
            listenToNonDelegatedEvent("toggle", domElement);
            listenToNonDelegatedEvent("cancel", domElement);
            listenToNonDelegatedEvent("close", domElement);
            break;
          case "iframe":
          case "object":
            listenToNonDelegatedEvent("load", domElement);
            break;
          case "video":
          case "audio":
            for (hasSrc = 0; hasSrc < mediaEventTypes.length; hasSrc++)
              listenToNonDelegatedEvent(mediaEventTypes[hasSrc], domElement);
            break;
          case "image":
            listenToNonDelegatedEvent("error", domElement);
            listenToNonDelegatedEvent("load", domElement);
            break;
          case "details":
            listenToNonDelegatedEvent("toggle", domElement);
            break;
          case "embed":
          case "source":
          case "link":
            listenToNonDelegatedEvent("error", domElement), listenToNonDelegatedEvent("load", domElement);
          case "area":
          case "base":
          case "br":
          case "col":
          case "hr":
          case "keygen":
          case "meta":
          case "param":
          case "track":
          case "wbr":
          case "menuitem":
            for (defaultChecked in props)
              if (props.hasOwnProperty(defaultChecked) && (hasSrc = props[defaultChecked], null != hasSrc))
                switch (defaultChecked) {
                  case "children":
                  case "dangerouslySetInnerHTML":
                    throw Error(formatProdErrorMessage(137, tag));
                  default:
                    setProp(domElement, tag, defaultChecked, hasSrc, props, null);
                }
            return;
          default:
            if (isCustomElement(tag)) {
              for (propValue$188 in props)
                props.hasOwnProperty(propValue$188) && (hasSrc = props[propValue$188], void 0 !== hasSrc && setPropOnCustomElement(
                  domElement,
                  tag,
                  propValue$188,
                  hasSrc,
                  props,
                  void 0
                ));
              return;
            }
        }
        for (defaultValue in props)
          props.hasOwnProperty(defaultValue) && (hasSrc = props[defaultValue], null != hasSrc && setProp(domElement, tag, defaultValue, hasSrc, props, null));
      }
      function updateProperties(domElement, tag, lastProps, nextProps) {
        switch (tag) {
          case "div":
          case "span":
          case "svg":
          case "path":
          case "a":
          case "g":
          case "p":
          case "li":
            break;
          case "input":
            var name = null, type = null, value = null, defaultValue = null, lastDefaultValue = null, checked = null, defaultChecked = null;
            for (propKey in lastProps) {
              var lastProp = lastProps[propKey];
              if (lastProps.hasOwnProperty(propKey) && null != lastProp)
                switch (propKey) {
                  case "checked":
                    break;
                  case "value":
                    break;
                  case "defaultValue":
                    lastDefaultValue = lastProp;
                  default:
                    nextProps.hasOwnProperty(propKey) || setProp(domElement, tag, propKey, null, nextProps, lastProp);
                }
            }
            for (var propKey$205 in nextProps) {
              var propKey = nextProps[propKey$205];
              lastProp = lastProps[propKey$205];
              if (nextProps.hasOwnProperty(propKey$205) && (null != propKey || null != lastProp))
                switch (propKey$205) {
                  case "type":
                    type = propKey;
                    break;
                  case "name":
                    name = propKey;
                    break;
                  case "checked":
                    checked = propKey;
                    break;
                  case "defaultChecked":
                    defaultChecked = propKey;
                    break;
                  case "value":
                    value = propKey;
                    break;
                  case "defaultValue":
                    defaultValue = propKey;
                    break;
                  case "children":
                  case "dangerouslySetInnerHTML":
                    if (null != propKey)
                      throw Error(formatProdErrorMessage(137, tag));
                    break;
                  default:
                    propKey !== lastProp && setProp(
                      domElement,
                      tag,
                      propKey$205,
                      propKey,
                      nextProps,
                      lastProp
                    );
                }
            }
            updateInput(
              domElement,
              value,
              defaultValue,
              lastDefaultValue,
              checked,
              defaultChecked,
              type,
              name
            );
            return;
          case "select":
            propKey = value = defaultValue = propKey$205 = null;
            for (type in lastProps)
              if (lastDefaultValue = lastProps[type], lastProps.hasOwnProperty(type) && null != lastDefaultValue)
                switch (type) {
                  case "value":
                    break;
                  case "multiple":
                    propKey = lastDefaultValue;
                  default:
                    nextProps.hasOwnProperty(type) || setProp(
                      domElement,
                      tag,
                      type,
                      null,
                      nextProps,
                      lastDefaultValue
                    );
                }
            for (name in nextProps)
              if (type = nextProps[name], lastDefaultValue = lastProps[name], nextProps.hasOwnProperty(name) && (null != type || null != lastDefaultValue))
                switch (name) {
                  case "value":
                    propKey$205 = type;
                    break;
                  case "defaultValue":
                    defaultValue = type;
                    break;
                  case "multiple":
                    value = type;
                  default:
                    type !== lastDefaultValue && setProp(
                      domElement,
                      tag,
                      name,
                      type,
                      nextProps,
                      lastDefaultValue
                    );
                }
            tag = defaultValue;
            lastProps = value;
            nextProps = propKey;
            null != propKey$205 ? updateOptions(domElement, !!lastProps, propKey$205, false) : !!nextProps !== !!lastProps && (null != tag ? updateOptions(domElement, !!lastProps, tag, true) : updateOptions(domElement, !!lastProps, lastProps ? [] : "", false));
            return;
          case "textarea":
            propKey = propKey$205 = null;
            for (defaultValue in lastProps)
              if (name = lastProps[defaultValue], lastProps.hasOwnProperty(defaultValue) && null != name && !nextProps.hasOwnProperty(defaultValue))
                switch (defaultValue) {
                  case "value":
                    break;
                  case "children":
                    break;
                  default:
                    setProp(domElement, tag, defaultValue, null, nextProps, name);
                }
            for (value in nextProps)
              if (name = nextProps[value], type = lastProps[value], nextProps.hasOwnProperty(value) && (null != name || null != type))
                switch (value) {
                  case "value":
                    propKey$205 = name;
                    break;
                  case "defaultValue":
                    propKey = name;
                    break;
                  case "children":
                    break;
                  case "dangerouslySetInnerHTML":
                    if (null != name) throw Error(formatProdErrorMessage(91));
                    break;
                  default:
                    name !== type && setProp(domElement, tag, value, name, nextProps, type);
                }
            updateTextarea(domElement, propKey$205, propKey);
            return;
          case "option":
            for (var propKey$221 in lastProps)
              if (propKey$205 = lastProps[propKey$221], lastProps.hasOwnProperty(propKey$221) && null != propKey$205 && !nextProps.hasOwnProperty(propKey$221))
                switch (propKey$221) {
                  case "selected":
                    domElement.selected = false;
                    break;
                  default:
                    setProp(
                      domElement,
                      tag,
                      propKey$221,
                      null,
                      nextProps,
                      propKey$205
                    );
                }
            for (lastDefaultValue in nextProps)
              if (propKey$205 = nextProps[lastDefaultValue], propKey = lastProps[lastDefaultValue], nextProps.hasOwnProperty(lastDefaultValue) && propKey$205 !== propKey && (null != propKey$205 || null != propKey))
                switch (lastDefaultValue) {
                  case "selected":
                    domElement.selected = propKey$205 && "function" !== typeof propKey$205 && "symbol" !== typeof propKey$205;
                    break;
                  default:
                    setProp(
                      domElement,
                      tag,
                      lastDefaultValue,
                      propKey$205,
                      nextProps,
                      propKey
                    );
                }
            return;
          case "img":
          case "link":
          case "area":
          case "base":
          case "br":
          case "col":
          case "embed":
          case "hr":
          case "keygen":
          case "meta":
          case "param":
          case "source":
          case "track":
          case "wbr":
          case "menuitem":
            for (var propKey$226 in lastProps)
              propKey$205 = lastProps[propKey$226], lastProps.hasOwnProperty(propKey$226) && null != propKey$205 && !nextProps.hasOwnProperty(propKey$226) && setProp(domElement, tag, propKey$226, null, nextProps, propKey$205);
            for (checked in nextProps)
              if (propKey$205 = nextProps[checked], propKey = lastProps[checked], nextProps.hasOwnProperty(checked) && propKey$205 !== propKey && (null != propKey$205 || null != propKey))
                switch (checked) {
                  case "children":
                  case "dangerouslySetInnerHTML":
                    if (null != propKey$205)
                      throw Error(formatProdErrorMessage(137, tag));
                    break;
                  default:
                    setProp(
                      domElement,
                      tag,
                      checked,
                      propKey$205,
                      nextProps,
                      propKey
                    );
                }
            return;
          default:
            if (isCustomElement(tag)) {
              for (var propKey$231 in lastProps)
                propKey$205 = lastProps[propKey$231], lastProps.hasOwnProperty(propKey$231) && void 0 !== propKey$205 && !nextProps.hasOwnProperty(propKey$231) && setPropOnCustomElement(
                  domElement,
                  tag,
                  propKey$231,
                  void 0,
                  nextProps,
                  propKey$205
                );
              for (defaultChecked in nextProps)
                propKey$205 = nextProps[defaultChecked], propKey = lastProps[defaultChecked], !nextProps.hasOwnProperty(defaultChecked) || propKey$205 === propKey || void 0 === propKey$205 && void 0 === propKey || setPropOnCustomElement(
                  domElement,
                  tag,
                  defaultChecked,
                  propKey$205,
                  nextProps,
                  propKey
                );
              return;
            }
        }
        for (var propKey$236 in lastProps)
          propKey$205 = lastProps[propKey$236], lastProps.hasOwnProperty(propKey$236) && null != propKey$205 && !nextProps.hasOwnProperty(propKey$236) && setProp(domElement, tag, propKey$236, null, nextProps, propKey$205);
        for (lastProp in nextProps)
          propKey$205 = nextProps[lastProp], propKey = lastProps[lastProp], !nextProps.hasOwnProperty(lastProp) || propKey$205 === propKey || null == propKey$205 && null == propKey || setProp(domElement, tag, lastProp, propKey$205, nextProps, propKey);
      }
      var eventsEnabled = null;
      var selectionInformation = null;
      function getOwnerDocumentFromRootContainer(rootContainerElement) {
        return 9 === rootContainerElement.nodeType ? rootContainerElement : rootContainerElement.ownerDocument;
      }
      function getOwnHostContext(namespaceURI) {
        switch (namespaceURI) {
          case "http://www.w3.org/2000/svg":
            return 1;
          case "http://www.w3.org/1998/Math/MathML":
            return 2;
          default:
            return 0;
        }
      }
      function getChildHostContextProd(parentNamespace, type) {
        if (0 === parentNamespace)
          switch (type) {
            case "svg":
              return 1;
            case "math":
              return 2;
            default:
              return 0;
          }
        return 1 === parentNamespace && "foreignObject" === type ? 0 : parentNamespace;
      }
      function shouldSetTextContent(type, props) {
        return "textarea" === type || "noscript" === type || "string" === typeof props.children || "number" === typeof props.children || "bigint" === typeof props.children || "object" === typeof props.dangerouslySetInnerHTML && null !== props.dangerouslySetInnerHTML && null != props.dangerouslySetInnerHTML.__html;
      }
      var currentPopstateTransitionEvent = null;
      function shouldAttemptEagerTransition() {
        var event = window.event;
        if (event && "popstate" === event.type) {
          if (event === currentPopstateTransitionEvent) return false;
          currentPopstateTransitionEvent = event;
          return true;
        }
        currentPopstateTransitionEvent = null;
        return false;
      }
      var scheduleTimeout = "function" === typeof setTimeout ? setTimeout : void 0;
      var cancelTimeout = "function" === typeof clearTimeout ? clearTimeout : void 0;
      var localPromise = "function" === typeof Promise ? Promise : void 0;
      var scheduleMicrotask = "function" === typeof queueMicrotask ? queueMicrotask : "undefined" !== typeof localPromise ? function(callback) {
        return localPromise.resolve(null).then(callback).catch(handleErrorInNextTick);
      } : scheduleTimeout;
      function handleErrorInNextTick(error) {
        setTimeout(function() {
          throw error;
        });
      }
      function isSingletonScope(type) {
        return "head" === type;
      }
      function clearSuspenseBoundary(parentInstance, suspenseInstance) {
        var node = suspenseInstance, possiblePreambleContribution = 0, depth = 0;
        do {
          var nextNode = node.nextSibling;
          parentInstance.removeChild(node);
          if (nextNode && 8 === nextNode.nodeType)
            if (node = nextNode.data, "/$" === node) {
              if (0 < possiblePreambleContribution && 8 > possiblePreambleContribution) {
                node = possiblePreambleContribution;
                var ownerDocument = parentInstance.ownerDocument;
                node & 1 && releaseSingletonInstance(ownerDocument.documentElement);
                node & 2 && releaseSingletonInstance(ownerDocument.body);
                if (node & 4)
                  for (node = ownerDocument.head, releaseSingletonInstance(node), ownerDocument = node.firstChild; ownerDocument; ) {
                    var nextNode$jscomp$0 = ownerDocument.nextSibling, nodeName = ownerDocument.nodeName;
                    ownerDocument[internalHoistableMarker] || "SCRIPT" === nodeName || "STYLE" === nodeName || "LINK" === nodeName && "stylesheet" === ownerDocument.rel.toLowerCase() || node.removeChild(ownerDocument);
                    ownerDocument = nextNode$jscomp$0;
                  }
              }
              if (0 === depth) {
                parentInstance.removeChild(nextNode);
                retryIfBlockedOn(suspenseInstance);
                return;
              }
              depth--;
            } else
              "$" === node || "$?" === node || "$!" === node ? depth++ : possiblePreambleContribution = node.charCodeAt(0) - 48;
          else possiblePreambleContribution = 0;
          node = nextNode;
        } while (node);
        retryIfBlockedOn(suspenseInstance);
      }
      function clearContainerSparingly(container) {
        var nextNode = container.firstChild;
        nextNode && 10 === nextNode.nodeType && (nextNode = nextNode.nextSibling);
        for (; nextNode; ) {
          var node = nextNode;
          nextNode = nextNode.nextSibling;
          switch (node.nodeName) {
            case "HTML":
            case "HEAD":
            case "BODY":
              clearContainerSparingly(node);
              detachDeletedInstance(node);
              continue;
            case "SCRIPT":
            case "STYLE":
              continue;
            case "LINK":
              if ("stylesheet" === node.rel.toLowerCase()) continue;
          }
          container.removeChild(node);
        }
      }
      function canHydrateInstance(instance, type, props, inRootOrSingleton) {
        for (; 1 === instance.nodeType; ) {
          var anyProps = props;
          if (instance.nodeName.toLowerCase() !== type.toLowerCase()) {
            if (!inRootOrSingleton && ("INPUT" !== instance.nodeName || "hidden" !== instance.type))
              break;
          } else if (!inRootOrSingleton)
            if ("input" === type && "hidden" === instance.type) {
              var name = null == anyProps.name ? null : "" + anyProps.name;
              if ("hidden" === anyProps.type && instance.getAttribute("name") === name)
                return instance;
            } else return instance;
          else if (!instance[internalHoistableMarker])
            switch (type) {
              case "meta":
                if (!instance.hasAttribute("itemprop")) break;
                return instance;
              case "link":
                name = instance.getAttribute("rel");
                if ("stylesheet" === name && instance.hasAttribute("data-precedence"))
                  break;
                else if (name !== anyProps.rel || instance.getAttribute("href") !== (null == anyProps.href || "" === anyProps.href ? null : anyProps.href) || instance.getAttribute("crossorigin") !== (null == anyProps.crossOrigin ? null : anyProps.crossOrigin) || instance.getAttribute("title") !== (null == anyProps.title ? null : anyProps.title))
                  break;
                return instance;
              case "style":
                if (instance.hasAttribute("data-precedence")) break;
                return instance;
              case "script":
                name = instance.getAttribute("src");
                if ((name !== (null == anyProps.src ? null : anyProps.src) || instance.getAttribute("type") !== (null == anyProps.type ? null : anyProps.type) || instance.getAttribute("crossorigin") !== (null == anyProps.crossOrigin ? null : anyProps.crossOrigin)) && name && instance.hasAttribute("async") && !instance.hasAttribute("itemprop"))
                  break;
                return instance;
              default:
                return instance;
            }
          instance = getNextHydratable(instance.nextSibling);
          if (null === instance) break;
        }
        return null;
      }
      function canHydrateTextInstance(instance, text, inRootOrSingleton) {
        if ("" === text) return null;
        for (; 3 !== instance.nodeType; ) {
          if ((1 !== instance.nodeType || "INPUT" !== instance.nodeName || "hidden" !== instance.type) && !inRootOrSingleton)
            return null;
          instance = getNextHydratable(instance.nextSibling);
          if (null === instance) return null;
        }
        return instance;
      }
      function isSuspenseInstanceFallback(instance) {
        return "$!" === instance.data || "$?" === instance.data && "complete" === instance.ownerDocument.readyState;
      }
      function registerSuspenseInstanceRetry(instance, callback) {
        var ownerDocument = instance.ownerDocument;
        if ("$?" !== instance.data || "complete" === ownerDocument.readyState)
          callback();
        else {
          var listener = function() {
            callback();
            ownerDocument.removeEventListener("DOMContentLoaded", listener);
          };
          ownerDocument.addEventListener("DOMContentLoaded", listener);
          instance._reactRetry = listener;
        }
      }
      function getNextHydratable(node) {
        for (; null != node; node = node.nextSibling) {
          var nodeType = node.nodeType;
          if (1 === nodeType || 3 === nodeType) break;
          if (8 === nodeType) {
            nodeType = node.data;
            if ("$" === nodeType || "$!" === nodeType || "$?" === nodeType || "F!" === nodeType || "F" === nodeType)
              break;
            if ("/$" === nodeType) return null;
          }
        }
        return node;
      }
      var previousHydratableOnEnteringScopedSingleton = null;
      function getParentSuspenseInstance(targetInstance) {
        targetInstance = targetInstance.previousSibling;
        for (var depth = 0; targetInstance; ) {
          if (8 === targetInstance.nodeType) {
            var data = targetInstance.data;
            if ("$" === data || "$!" === data || "$?" === data) {
              if (0 === depth) return targetInstance;
              depth--;
            } else "/$" === data && depth++;
          }
          targetInstance = targetInstance.previousSibling;
        }
        return null;
      }
      function resolveSingletonInstance(type, props, rootContainerInstance) {
        props = getOwnerDocumentFromRootContainer(rootContainerInstance);
        switch (type) {
          case "html":
            type = props.documentElement;
            if (!type) throw Error(formatProdErrorMessage(452));
            return type;
          case "head":
            type = props.head;
            if (!type) throw Error(formatProdErrorMessage(453));
            return type;
          case "body":
            type = props.body;
            if (!type) throw Error(formatProdErrorMessage(454));
            return type;
          default:
            throw Error(formatProdErrorMessage(451));
        }
      }
      function releaseSingletonInstance(instance) {
        for (var attributes = instance.attributes; attributes.length; )
          instance.removeAttributeNode(attributes[0]);
        detachDeletedInstance(instance);
      }
      var preloadPropsMap = /* @__PURE__ */ new Map();
      var preconnectsSet = /* @__PURE__ */ new Set();
      function getHoistableRoot(container) {
        return "function" === typeof container.getRootNode ? container.getRootNode() : 9 === container.nodeType ? container : container.ownerDocument;
      }
      var previousDispatcher = ReactDOMSharedInternals.d;
      ReactDOMSharedInternals.d = {
        f: flushSyncWork,
        r: requestFormReset,
        D: prefetchDNS,
        C: preconnect,
        L: preload,
        m: preloadModule,
        X: preinitScript,
        S: preinitStyle,
        M: preinitModuleScript
      };
      function flushSyncWork() {
        var previousWasRendering = previousDispatcher.f(), wasRendering = flushSyncWork$1();
        return previousWasRendering || wasRendering;
      }
      function requestFormReset(form) {
        var formInst = getInstanceFromNode(form);
        null !== formInst && 5 === formInst.tag && "form" === formInst.type ? requestFormReset$1(formInst) : previousDispatcher.r(form);
      }
      var globalDocument = "undefined" === typeof document ? null : document;
      function preconnectAs(rel, href, crossOrigin) {
        var ownerDocument = globalDocument;
        if (ownerDocument && "string" === typeof href && href) {
          var limitedEscapedHref = escapeSelectorAttributeValueInsideDoubleQuotes(href);
          limitedEscapedHref = 'link[rel="' + rel + '"][href="' + limitedEscapedHref + '"]';
          "string" === typeof crossOrigin && (limitedEscapedHref += '[crossorigin="' + crossOrigin + '"]');
          preconnectsSet.has(limitedEscapedHref) || (preconnectsSet.add(limitedEscapedHref), rel = { rel, crossOrigin, href }, null === ownerDocument.querySelector(limitedEscapedHref) && (href = ownerDocument.createElement("link"), setInitialProperties(href, "link", rel), markNodeAsHoistable(href), ownerDocument.head.appendChild(href)));
        }
      }
      function prefetchDNS(href) {
        previousDispatcher.D(href);
        preconnectAs("dns-prefetch", href, null);
      }
      function preconnect(href, crossOrigin) {
        previousDispatcher.C(href, crossOrigin);
        preconnectAs("preconnect", href, crossOrigin);
      }
      function preload(href, as, options2) {
        previousDispatcher.L(href, as, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && href && as) {
          var preloadSelector = 'link[rel="preload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"]';
          "image" === as ? options2 && options2.imageSrcSet ? (preloadSelector += '[imagesrcset="' + escapeSelectorAttributeValueInsideDoubleQuotes(
            options2.imageSrcSet
          ) + '"]', "string" === typeof options2.imageSizes && (preloadSelector += '[imagesizes="' + escapeSelectorAttributeValueInsideDoubleQuotes(
            options2.imageSizes
          ) + '"]')) : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]' : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]';
          var key = preloadSelector;
          switch (as) {
            case "style":
              key = getStyleKey(href);
              break;
            case "script":
              key = getScriptKey(href);
          }
          preloadPropsMap.has(key) || (href = assign(
            {
              rel: "preload",
              href: "image" === as && options2 && options2.imageSrcSet ? void 0 : href,
              as
            },
            options2
          ), preloadPropsMap.set(key, href), null !== ownerDocument.querySelector(preloadSelector) || "style" === as && ownerDocument.querySelector(getStylesheetSelectorFromKey(key)) || "script" === as && ownerDocument.querySelector(getScriptSelectorFromKey(key)) || (as = ownerDocument.createElement("link"), setInitialProperties(as, "link", href), markNodeAsHoistable(as), ownerDocument.head.appendChild(as)));
        }
      }
      function preloadModule(href, options2) {
        previousDispatcher.m(href, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && href) {
          var as = options2 && "string" === typeof options2.as ? options2.as : "script", preloadSelector = 'link[rel="modulepreload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"][href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]', key = preloadSelector;
          switch (as) {
            case "audioworklet":
            case "paintworklet":
            case "serviceworker":
            case "sharedworker":
            case "worker":
            case "script":
              key = getScriptKey(href);
          }
          if (!preloadPropsMap.has(key) && (href = assign({ rel: "modulepreload", href }, options2), preloadPropsMap.set(key, href), null === ownerDocument.querySelector(preloadSelector))) {
            switch (as) {
              case "audioworklet":
              case "paintworklet":
              case "serviceworker":
              case "sharedworker":
              case "worker":
              case "script":
                if (ownerDocument.querySelector(getScriptSelectorFromKey(key)))
                  return;
            }
            as = ownerDocument.createElement("link");
            setInitialProperties(as, "link", href);
            markNodeAsHoistable(as);
            ownerDocument.head.appendChild(as);
          }
        }
      }
      function preinitStyle(href, precedence, options2) {
        previousDispatcher.S(href, precedence, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && href) {
          var styles16 = getResourcesFromRoot(ownerDocument).hoistableStyles, key = getStyleKey(href);
          precedence = precedence || "default";
          var resource = styles16.get(key);
          if (!resource) {
            var state = { loading: 0, preload: null };
            if (resource = ownerDocument.querySelector(
              getStylesheetSelectorFromKey(key)
            ))
              state.loading = 5;
            else {
              href = assign(
                { rel: "stylesheet", href, "data-precedence": precedence },
                options2
              );
              (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(href, options2);
              var link = resource = ownerDocument.createElement("link");
              markNodeAsHoistable(link);
              setInitialProperties(link, "link", href);
              link._p = new Promise(function(resolve, reject) {
                link.onload = resolve;
                link.onerror = reject;
              });
              link.addEventListener("load", function() {
                state.loading |= 1;
              });
              link.addEventListener("error", function() {
                state.loading |= 2;
              });
              state.loading |= 4;
              insertStylesheet(resource, precedence, ownerDocument);
            }
            resource = {
              type: "stylesheet",
              instance: resource,
              count: 1,
              state
            };
            styles16.set(key, resource);
          }
        }
      }
      function preinitScript(src, options2) {
        previousDispatcher.X(src, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && src) {
          var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
          resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
            type: "script",
            instance: resource,
            count: 1,
            state: null
          }, scripts.set(key, resource));
        }
      }
      function preinitModuleScript(src, options2) {
        previousDispatcher.M(src, options2);
        var ownerDocument = globalDocument;
        if (ownerDocument && src) {
          var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
          resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true, type: "module" }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
            type: "script",
            instance: resource,
            count: 1,
            state: null
          }, scripts.set(key, resource));
        }
      }
      function getResource(type, currentProps, pendingProps, currentResource) {
        var JSCompiler_inline_result = (JSCompiler_inline_result = rootInstanceStackCursor.current) ? getHoistableRoot(JSCompiler_inline_result) : null;
        if (!JSCompiler_inline_result) throw Error(formatProdErrorMessage(446));
        switch (type) {
          case "meta":
          case "title":
            return null;
          case "style":
            return "string" === typeof pendingProps.precedence && "string" === typeof pendingProps.href ? (currentProps = getStyleKey(pendingProps.href), pendingProps = getResourcesFromRoot(
              JSCompiler_inline_result
            ).hoistableStyles, currentResource = pendingProps.get(currentProps), currentResource || (currentResource = {
              type: "style",
              instance: null,
              count: 0,
              state: null
            }, pendingProps.set(currentProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
          case "link":
            if ("stylesheet" === pendingProps.rel && "string" === typeof pendingProps.href && "string" === typeof pendingProps.precedence) {
              type = getStyleKey(pendingProps.href);
              var styles$244 = getResourcesFromRoot(
                JSCompiler_inline_result
              ).hoistableStyles, resource$245 = styles$244.get(type);
              resource$245 || (JSCompiler_inline_result = JSCompiler_inline_result.ownerDocument || JSCompiler_inline_result, resource$245 = {
                type: "stylesheet",
                instance: null,
                count: 0,
                state: { loading: 0, preload: null }
              }, styles$244.set(type, resource$245), (styles$244 = JSCompiler_inline_result.querySelector(
                getStylesheetSelectorFromKey(type)
              )) && !styles$244._p && (resource$245.instance = styles$244, resource$245.state.loading = 5), preloadPropsMap.has(type) || (pendingProps = {
                rel: "preload",
                as: "style",
                href: pendingProps.href,
                crossOrigin: pendingProps.crossOrigin,
                integrity: pendingProps.integrity,
                media: pendingProps.media,
                hrefLang: pendingProps.hrefLang,
                referrerPolicy: pendingProps.referrerPolicy
              }, preloadPropsMap.set(type, pendingProps), styles$244 || preloadStylesheet(
                JSCompiler_inline_result,
                type,
                pendingProps,
                resource$245.state
              )));
              if (currentProps && null === currentResource)
                throw Error(formatProdErrorMessage(528, ""));
              return resource$245;
            }
            if (currentProps && null !== currentResource)
              throw Error(formatProdErrorMessage(529, ""));
            return null;
          case "script":
            return currentProps = pendingProps.async, pendingProps = pendingProps.src, "string" === typeof pendingProps && currentProps && "function" !== typeof currentProps && "symbol" !== typeof currentProps ? (currentProps = getScriptKey(pendingProps), pendingProps = getResourcesFromRoot(
              JSCompiler_inline_result
            ).hoistableScripts, currentResource = pendingProps.get(currentProps), currentResource || (currentResource = {
              type: "script",
              instance: null,
              count: 0,
              state: null
            }, pendingProps.set(currentProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
          default:
            throw Error(formatProdErrorMessage(444, type));
        }
      }
      function getStyleKey(href) {
        return 'href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"';
      }
      function getStylesheetSelectorFromKey(key) {
        return 'link[rel="stylesheet"][' + key + "]";
      }
      function stylesheetPropsFromRawProps(rawProps) {
        return assign({}, rawProps, {
          "data-precedence": rawProps.precedence,
          precedence: null
        });
      }
      function preloadStylesheet(ownerDocument, key, preloadProps, state) {
        ownerDocument.querySelector('link[rel="preload"][as="style"][' + key + "]") ? state.loading = 1 : (key = ownerDocument.createElement("link"), state.preload = key, key.addEventListener("load", function() {
          return state.loading |= 1;
        }), key.addEventListener("error", function() {
          return state.loading |= 2;
        }), setInitialProperties(key, "link", preloadProps), markNodeAsHoistable(key), ownerDocument.head.appendChild(key));
      }
      function getScriptKey(src) {
        return '[src="' + escapeSelectorAttributeValueInsideDoubleQuotes(src) + '"]';
      }
      function getScriptSelectorFromKey(key) {
        return "script[async]" + key;
      }
      function acquireResource(hoistableRoot, resource, props) {
        resource.count++;
        if (null === resource.instance)
          switch (resource.type) {
            case "style":
              var instance = hoistableRoot.querySelector(
                'style[data-href~="' + escapeSelectorAttributeValueInsideDoubleQuotes(props.href) + '"]'
              );
              if (instance)
                return resource.instance = instance, markNodeAsHoistable(instance), instance;
              var styleProps2 = assign({}, props, {
                "data-href": props.href,
                "data-precedence": props.precedence,
                href: null,
                precedence: null
              });
              instance = (hoistableRoot.ownerDocument || hoistableRoot).createElement(
                "style"
              );
              markNodeAsHoistable(instance);
              setInitialProperties(instance, "style", styleProps2);
              insertStylesheet(instance, props.precedence, hoistableRoot);
              return resource.instance = instance;
            case "stylesheet":
              styleProps2 = getStyleKey(props.href);
              var instance$250 = hoistableRoot.querySelector(
                getStylesheetSelectorFromKey(styleProps2)
              );
              if (instance$250)
                return resource.state.loading |= 4, resource.instance = instance$250, markNodeAsHoistable(instance$250), instance$250;
              instance = stylesheetPropsFromRawProps(props);
              (styleProps2 = preloadPropsMap.get(styleProps2)) && adoptPreloadPropsForStylesheet(instance, styleProps2);
              instance$250 = (hoistableRoot.ownerDocument || hoistableRoot).createElement("link");
              markNodeAsHoistable(instance$250);
              var linkInstance = instance$250;
              linkInstance._p = new Promise(function(resolve, reject) {
                linkInstance.onload = resolve;
                linkInstance.onerror = reject;
              });
              setInitialProperties(instance$250, "link", instance);
              resource.state.loading |= 4;
              insertStylesheet(instance$250, props.precedence, hoistableRoot);
              return resource.instance = instance$250;
            case "script":
              instance$250 = getScriptKey(props.src);
              if (styleProps2 = hoistableRoot.querySelector(
                getScriptSelectorFromKey(instance$250)
              ))
                return resource.instance = styleProps2, markNodeAsHoistable(styleProps2), styleProps2;
              instance = props;
              if (styleProps2 = preloadPropsMap.get(instance$250))
                instance = assign({}, props), adoptPreloadPropsForScript(instance, styleProps2);
              hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
              styleProps2 = hoistableRoot.createElement("script");
              markNodeAsHoistable(styleProps2);
              setInitialProperties(styleProps2, "link", instance);
              hoistableRoot.head.appendChild(styleProps2);
              return resource.instance = styleProps2;
            case "void":
              return null;
            default:
              throw Error(formatProdErrorMessage(443, resource.type));
          }
        else
          "stylesheet" === resource.type && 0 === (resource.state.loading & 4) && (instance = resource.instance, resource.state.loading |= 4, insertStylesheet(instance, props.precedence, hoistableRoot));
        return resource.instance;
      }
      function insertStylesheet(instance, precedence, root2) {
        for (var nodes = root2.querySelectorAll(
          'link[rel="stylesheet"][data-precedence],style[data-precedence]'
        ), last = nodes.length ? nodes[nodes.length - 1] : null, prior = last, i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          if (node.dataset.precedence === precedence) prior = node;
          else if (prior !== last) break;
        }
        prior ? prior.parentNode.insertBefore(instance, prior.nextSibling) : (precedence = 9 === root2.nodeType ? root2.head : root2, precedence.insertBefore(instance, precedence.firstChild));
      }
      function adoptPreloadPropsForStylesheet(stylesheetProps, preloadProps) {
        null == stylesheetProps.crossOrigin && (stylesheetProps.crossOrigin = preloadProps.crossOrigin);
        null == stylesheetProps.referrerPolicy && (stylesheetProps.referrerPolicy = preloadProps.referrerPolicy);
        null == stylesheetProps.title && (stylesheetProps.title = preloadProps.title);
      }
      function adoptPreloadPropsForScript(scriptProps, preloadProps) {
        null == scriptProps.crossOrigin && (scriptProps.crossOrigin = preloadProps.crossOrigin);
        null == scriptProps.referrerPolicy && (scriptProps.referrerPolicy = preloadProps.referrerPolicy);
        null == scriptProps.integrity && (scriptProps.integrity = preloadProps.integrity);
      }
      var tagCaches = null;
      function getHydratableHoistableCache(type, keyAttribute, ownerDocument) {
        if (null === tagCaches) {
          var cache4 = /* @__PURE__ */ new Map();
          var caches = tagCaches = /* @__PURE__ */ new Map();
          caches.set(ownerDocument, cache4);
        } else
          caches = tagCaches, cache4 = caches.get(ownerDocument), cache4 || (cache4 = /* @__PURE__ */ new Map(), caches.set(ownerDocument, cache4));
        if (cache4.has(type)) return cache4;
        cache4.set(type, null);
        ownerDocument = ownerDocument.getElementsByTagName(type);
        for (caches = 0; caches < ownerDocument.length; caches++) {
          var node = ownerDocument[caches];
          if (!(node[internalHoistableMarker] || node[internalInstanceKey] || "link" === type && "stylesheet" === node.getAttribute("rel")) && "http://www.w3.org/2000/svg" !== node.namespaceURI) {
            var nodeKey = node.getAttribute(keyAttribute) || "";
            nodeKey = type + nodeKey;
            var existing = cache4.get(nodeKey);
            existing ? existing.push(node) : cache4.set(nodeKey, [node]);
          }
        }
        return cache4;
      }
      function mountHoistable(hoistableRoot, type, instance) {
        hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
        hoistableRoot.head.insertBefore(
          instance,
          "title" === type ? hoistableRoot.querySelector("head > title") : null
        );
      }
      function isHostHoistableType(type, props, hostContext) {
        if (1 === hostContext || null != props.itemProp) return false;
        switch (type) {
          case "meta":
          case "title":
            return true;
          case "style":
            if ("string" !== typeof props.precedence || "string" !== typeof props.href || "" === props.href)
              break;
            return true;
          case "link":
            if ("string" !== typeof props.rel || "string" !== typeof props.href || "" === props.href || props.onLoad || props.onError)
              break;
            switch (props.rel) {
              case "stylesheet":
                return type = props.disabled, "string" === typeof props.precedence && null == type;
              default:
                return true;
            }
          case "script":
            if (props.async && "function" !== typeof props.async && "symbol" !== typeof props.async && !props.onLoad && !props.onError && props.src && "string" === typeof props.src)
              return true;
        }
        return false;
      }
      function preloadResource(resource) {
        return "stylesheet" === resource.type && 0 === (resource.state.loading & 3) ? false : true;
      }
      var suspendedState = null;
      function noop() {
      }
      function suspendResource(hoistableRoot, resource, props) {
        if (null === suspendedState) throw Error(formatProdErrorMessage(475));
        var state = suspendedState;
        if ("stylesheet" === resource.type && ("string" !== typeof props.media || false !== matchMedia(props.media).matches) && 0 === (resource.state.loading & 4)) {
          if (null === resource.instance) {
            var key = getStyleKey(props.href), instance = hoistableRoot.querySelector(
              getStylesheetSelectorFromKey(key)
            );
            if (instance) {
              hoistableRoot = instance._p;
              null !== hoistableRoot && "object" === typeof hoistableRoot && "function" === typeof hoistableRoot.then && (state.count++, state = onUnsuspend.bind(state), hoistableRoot.then(state, state));
              resource.state.loading |= 4;
              resource.instance = instance;
              markNodeAsHoistable(instance);
              return;
            }
            instance = hoistableRoot.ownerDocument || hoistableRoot;
            props = stylesheetPropsFromRawProps(props);
            (key = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(props, key);
            instance = instance.createElement("link");
            markNodeAsHoistable(instance);
            var linkInstance = instance;
            linkInstance._p = new Promise(function(resolve, reject) {
              linkInstance.onload = resolve;
              linkInstance.onerror = reject;
            });
            setInitialProperties(instance, "link", props);
            resource.instance = instance;
          }
          null === state.stylesheets && (state.stylesheets = /* @__PURE__ */ new Map());
          state.stylesheets.set(resource, hoistableRoot);
          (hoistableRoot = resource.state.preload) && 0 === (resource.state.loading & 3) && (state.count++, resource = onUnsuspend.bind(state), hoistableRoot.addEventListener("load", resource), hoistableRoot.addEventListener("error", resource));
        }
      }
      function waitForCommitToBeReady() {
        if (null === suspendedState) throw Error(formatProdErrorMessage(475));
        var state = suspendedState;
        state.stylesheets && 0 === state.count && insertSuspendedStylesheets(state, state.stylesheets);
        return 0 < state.count ? function(commit) {
          var stylesheetTimer = setTimeout(function() {
            state.stylesheets && insertSuspendedStylesheets(state, state.stylesheets);
            if (state.unsuspend) {
              var unsuspend = state.unsuspend;
              state.unsuspend = null;
              unsuspend();
            }
          }, 6e4);
          state.unsuspend = commit;
          return function() {
            state.unsuspend = null;
            clearTimeout(stylesheetTimer);
          };
        } : null;
      }
      function onUnsuspend() {
        this.count--;
        if (0 === this.count) {
          if (this.stylesheets) insertSuspendedStylesheets(this, this.stylesheets);
          else if (this.unsuspend) {
            var unsuspend = this.unsuspend;
            this.unsuspend = null;
            unsuspend();
          }
        }
      }
      var precedencesByRoot = null;
      function insertSuspendedStylesheets(state, resources) {
        state.stylesheets = null;
        null !== state.unsuspend && (state.count++, precedencesByRoot = /* @__PURE__ */ new Map(), resources.forEach(insertStylesheetIntoRoot, state), precedencesByRoot = null, onUnsuspend.call(state));
      }
      function insertStylesheetIntoRoot(root2, resource) {
        if (!(resource.state.loading & 4)) {
          var precedences = precedencesByRoot.get(root2);
          if (precedences) var last = precedences.get(null);
          else {
            precedences = /* @__PURE__ */ new Map();
            precedencesByRoot.set(root2, precedences);
            for (var nodes = root2.querySelectorAll(
              "link[data-precedence],style[data-precedence]"
            ), i = 0; i < nodes.length; i++) {
              var node = nodes[i];
              if ("LINK" === node.nodeName || "not all" !== node.getAttribute("media"))
                precedences.set(node.dataset.precedence, node), last = node;
            }
            last && precedences.set(null, last);
          }
          nodes = resource.instance;
          node = nodes.getAttribute("data-precedence");
          i = precedences.get(node) || last;
          i === last && precedences.set(null, nodes);
          precedences.set(node, nodes);
          this.count++;
          last = onUnsuspend.bind(this);
          nodes.addEventListener("load", last);
          nodes.addEventListener("error", last);
          i ? i.parentNode.insertBefore(nodes, i.nextSibling) : (root2 = 9 === root2.nodeType ? root2.head : root2, root2.insertBefore(nodes, root2.firstChild));
          resource.state.loading |= 4;
        }
      }
      var HostTransitionContext = {
        $$typeof: REACT_CONTEXT_TYPE,
        Provider: null,
        Consumer: null,
        _currentValue: sharedNotPendingObject,
        _currentValue2: sharedNotPendingObject,
        _threadCount: 0
      };
      function FiberRootNode(containerInfo, tag, hydrate, identifierPrefix, onUncaughtError, onCaughtError, onRecoverableError, formState) {
        this.tag = 1;
        this.containerInfo = containerInfo;
        this.pingCache = this.current = this.pendingChildren = null;
        this.timeoutHandle = -1;
        this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null;
        this.callbackPriority = 0;
        this.expirationTimes = createLaneMap(-1);
        this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
        this.entanglements = createLaneMap(0);
        this.hiddenUpdates = createLaneMap(null);
        this.identifierPrefix = identifierPrefix;
        this.onUncaughtError = onUncaughtError;
        this.onCaughtError = onCaughtError;
        this.onRecoverableError = onRecoverableError;
        this.pooledCache = null;
        this.pooledCacheLanes = 0;
        this.formState = formState;
        this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function createFiberRoot(containerInfo, tag, hydrate, initialChildren, hydrationCallbacks, isStrictMode, identifierPrefix, onUncaughtError, onCaughtError, onRecoverableError, transitionCallbacks, formState) {
        containerInfo = new FiberRootNode(
          containerInfo,
          tag,
          hydrate,
          identifierPrefix,
          onUncaughtError,
          onCaughtError,
          onRecoverableError,
          formState
        );
        tag = 1;
        true === isStrictMode && (tag |= 24);
        isStrictMode = createFiberImplClass(3, null, null, tag);
        containerInfo.current = isStrictMode;
        isStrictMode.stateNode = containerInfo;
        tag = createCache();
        tag.refCount++;
        containerInfo.pooledCache = tag;
        tag.refCount++;
        isStrictMode.memoizedState = {
          element: initialChildren,
          isDehydrated: hydrate,
          cache: tag
        };
        initializeUpdateQueue(isStrictMode);
        return containerInfo;
      }
      function getContextForSubtree(parentComponent) {
        if (!parentComponent) return emptyContextObject;
        parentComponent = emptyContextObject;
        return parentComponent;
      }
      function updateContainerImpl(rootFiber, lane, element, container, parentComponent, callback) {
        parentComponent = getContextForSubtree(parentComponent);
        null === container.context ? container.context = parentComponent : container.pendingContext = parentComponent;
        container = createUpdate(lane);
        container.payload = { element };
        callback = void 0 === callback ? null : callback;
        null !== callback && (container.callback = callback);
        element = enqueueUpdate(rootFiber, container, lane);
        null !== element && (scheduleUpdateOnFiber(element, rootFiber, lane), entangleTransitions(element, rootFiber, lane));
      }
      function markRetryLaneImpl(fiber, retryLane) {
        fiber = fiber.memoizedState;
        if (null !== fiber && null !== fiber.dehydrated) {
          var a = fiber.retryLane;
          fiber.retryLane = 0 !== a && a < retryLane ? a : retryLane;
        }
      }
      function markRetryLaneIfNotHydrated(fiber, retryLane) {
        markRetryLaneImpl(fiber, retryLane);
        (fiber = fiber.alternate) && markRetryLaneImpl(fiber, retryLane);
      }
      function attemptContinuousHydration(fiber) {
        if (13 === fiber.tag) {
          var root2 = enqueueConcurrentRenderForLane(fiber, 67108864);
          null !== root2 && scheduleUpdateOnFiber(root2, fiber, 67108864);
          markRetryLaneIfNotHydrated(fiber, 67108864);
        }
      }
      var _enabled = true;
      function dispatchDiscreteEvent(domEventName, eventSystemFlags, container, nativeEvent) {
        var prevTransition = ReactSharedInternals.T;
        ReactSharedInternals.T = null;
        var previousPriority = ReactDOMSharedInternals.p;
        try {
          ReactDOMSharedInternals.p = 2, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
        } finally {
          ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
        }
      }
      function dispatchContinuousEvent(domEventName, eventSystemFlags, container, nativeEvent) {
        var prevTransition = ReactSharedInternals.T;
        ReactSharedInternals.T = null;
        var previousPriority = ReactDOMSharedInternals.p;
        try {
          ReactDOMSharedInternals.p = 8, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
        } finally {
          ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
        }
      }
      function dispatchEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent) {
        if (_enabled) {
          var blockedOn = findInstanceBlockingEvent(nativeEvent);
          if (null === blockedOn)
            dispatchEventForPluginEventSystem(
              domEventName,
              eventSystemFlags,
              nativeEvent,
              return_targetInst,
              targetContainer
            ), clearIfContinuousEvent(domEventName, nativeEvent);
          else if (queueIfContinuousEvent(
            blockedOn,
            domEventName,
            eventSystemFlags,
            targetContainer,
            nativeEvent
          ))
            nativeEvent.stopPropagation();
          else if (clearIfContinuousEvent(domEventName, nativeEvent), eventSystemFlags & 4 && -1 < discreteReplayableEvents.indexOf(domEventName)) {
            for (; null !== blockedOn; ) {
              var fiber = getInstanceFromNode(blockedOn);
              if (null !== fiber)
                switch (fiber.tag) {
                  case 3:
                    fiber = fiber.stateNode;
                    if (fiber.current.memoizedState.isDehydrated) {
                      var lanes = getHighestPriorityLanes(fiber.pendingLanes);
                      if (0 !== lanes) {
                        var root2 = fiber;
                        root2.pendingLanes |= 2;
                        for (root2.entangledLanes |= 2; lanes; ) {
                          var lane = 1 << 31 - clz32(lanes);
                          root2.entanglements[1] |= lane;
                          lanes &= ~lane;
                        }
                        ensureRootIsScheduled(fiber);
                        0 === (executionContext & 6) && (workInProgressRootRenderTargetTime = now() + 500, flushSyncWorkAcrossRoots_impl(0, false));
                      }
                    }
                    break;
                  case 13:
                    root2 = enqueueConcurrentRenderForLane(fiber, 2), null !== root2 && scheduleUpdateOnFiber(root2, fiber, 2), flushSyncWork$1(), markRetryLaneIfNotHydrated(fiber, 2);
                }
              fiber = findInstanceBlockingEvent(nativeEvent);
              null === fiber && dispatchEventForPluginEventSystem(
                domEventName,
                eventSystemFlags,
                nativeEvent,
                return_targetInst,
                targetContainer
              );
              if (fiber === blockedOn) break;
              blockedOn = fiber;
            }
            null !== blockedOn && nativeEvent.stopPropagation();
          } else
            dispatchEventForPluginEventSystem(
              domEventName,
              eventSystemFlags,
              nativeEvent,
              null,
              targetContainer
            );
        }
      }
      function findInstanceBlockingEvent(nativeEvent) {
        nativeEvent = getEventTarget(nativeEvent);
        return findInstanceBlockingTarget(nativeEvent);
      }
      var return_targetInst = null;
      function findInstanceBlockingTarget(targetNode) {
        return_targetInst = null;
        targetNode = getClosestInstanceFromNode(targetNode);
        if (null !== targetNode) {
          var nearestMounted = getNearestMountedFiber(targetNode);
          if (null === nearestMounted) targetNode = null;
          else {
            var tag = nearestMounted.tag;
            if (13 === tag) {
              targetNode = getSuspenseInstanceFromFiber(nearestMounted);
              if (null !== targetNode) return targetNode;
              targetNode = null;
            } else if (3 === tag) {
              if (nearestMounted.stateNode.current.memoizedState.isDehydrated)
                return 3 === nearestMounted.tag ? nearestMounted.stateNode.containerInfo : null;
              targetNode = null;
            } else nearestMounted !== targetNode && (targetNode = null);
          }
        }
        return_targetInst = targetNode;
        return null;
      }
      function getEventPriority(domEventName) {
        switch (domEventName) {
          case "beforetoggle":
          case "cancel":
          case "click":
          case "close":
          case "contextmenu":
          case "copy":
          case "cut":
          case "auxclick":
          case "dblclick":
          case "dragend":
          case "dragstart":
          case "drop":
          case "focusin":
          case "focusout":
          case "input":
          case "invalid":
          case "keydown":
          case "keypress":
          case "keyup":
          case "mousedown":
          case "mouseup":
          case "paste":
          case "pause":
          case "play":
          case "pointercancel":
          case "pointerdown":
          case "pointerup":
          case "ratechange":
          case "reset":
          case "resize":
          case "seeked":
          case "submit":
          case "toggle":
          case "touchcancel":
          case "touchend":
          case "touchstart":
          case "volumechange":
          case "change":
          case "selectionchange":
          case "textInput":
          case "compositionstart":
          case "compositionend":
          case "compositionupdate":
          case "beforeblur":
          case "afterblur":
          case "beforeinput":
          case "blur":
          case "fullscreenchange":
          case "focus":
          case "hashchange":
          case "popstate":
          case "select":
          case "selectstart":
            return 2;
          case "drag":
          case "dragenter":
          case "dragexit":
          case "dragleave":
          case "dragover":
          case "mousemove":
          case "mouseout":
          case "mouseover":
          case "pointermove":
          case "pointerout":
          case "pointerover":
          case "scroll":
          case "touchmove":
          case "wheel":
          case "mouseenter":
          case "mouseleave":
          case "pointerenter":
          case "pointerleave":
            return 8;
          case "message":
            switch (getCurrentPriorityLevel()) {
              case ImmediatePriority:
                return 2;
              case UserBlockingPriority:
                return 8;
              case NormalPriority$1:
              case LowPriority:
                return 32;
              case IdlePriority:
                return 268435456;
              default:
                return 32;
            }
          default:
            return 32;
        }
      }
      var hasScheduledReplayAttempt = false;
      var queuedFocus = null;
      var queuedDrag = null;
      var queuedMouse = null;
      var queuedPointers = /* @__PURE__ */ new Map();
      var queuedPointerCaptures = /* @__PURE__ */ new Map();
      var queuedExplicitHydrationTargets = [];
      var discreteReplayableEvents = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
        " "
      );
      function clearIfContinuousEvent(domEventName, nativeEvent) {
        switch (domEventName) {
          case "focusin":
          case "focusout":
            queuedFocus = null;
            break;
          case "dragenter":
          case "dragleave":
            queuedDrag = null;
            break;
          case "mouseover":
          case "mouseout":
            queuedMouse = null;
            break;
          case "pointerover":
          case "pointerout":
            queuedPointers.delete(nativeEvent.pointerId);
            break;
          case "gotpointercapture":
          case "lostpointercapture":
            queuedPointerCaptures.delete(nativeEvent.pointerId);
        }
      }
      function accumulateOrCreateContinuousQueuedReplayableEvent(existingQueuedEvent, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
        if (null === existingQueuedEvent || existingQueuedEvent.nativeEvent !== nativeEvent)
          return existingQueuedEvent = {
            blockedOn,
            domEventName,
            eventSystemFlags,
            nativeEvent,
            targetContainers: [targetContainer]
          }, null !== blockedOn && (blockedOn = getInstanceFromNode(blockedOn), null !== blockedOn && attemptContinuousHydration(blockedOn)), existingQueuedEvent;
        existingQueuedEvent.eventSystemFlags |= eventSystemFlags;
        blockedOn = existingQueuedEvent.targetContainers;
        null !== targetContainer && -1 === blockedOn.indexOf(targetContainer) && blockedOn.push(targetContainer);
        return existingQueuedEvent;
      }
      function queueIfContinuousEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
        switch (domEventName) {
          case "focusin":
            return queuedFocus = accumulateOrCreateContinuousQueuedReplayableEvent(
              queuedFocus,
              blockedOn,
              domEventName,
              eventSystemFlags,
              targetContainer,
              nativeEvent
            ), true;
          case "dragenter":
            return queuedDrag = accumulateOrCreateContinuousQueuedReplayableEvent(
              queuedDrag,
              blockedOn,
              domEventName,
              eventSystemFlags,
              targetContainer,
              nativeEvent
            ), true;
          case "mouseover":
            return queuedMouse = accumulateOrCreateContinuousQueuedReplayableEvent(
              queuedMouse,
              blockedOn,
              domEventName,
              eventSystemFlags,
              targetContainer,
              nativeEvent
            ), true;
          case "pointerover":
            var pointerId = nativeEvent.pointerId;
            queuedPointers.set(
              pointerId,
              accumulateOrCreateContinuousQueuedReplayableEvent(
                queuedPointers.get(pointerId) || null,
                blockedOn,
                domEventName,
                eventSystemFlags,
                targetContainer,
                nativeEvent
              )
            );
            return true;
          case "gotpointercapture":
            return pointerId = nativeEvent.pointerId, queuedPointerCaptures.set(
              pointerId,
              accumulateOrCreateContinuousQueuedReplayableEvent(
                queuedPointerCaptures.get(pointerId) || null,
                blockedOn,
                domEventName,
                eventSystemFlags,
                targetContainer,
                nativeEvent
              )
            ), true;
        }
        return false;
      }
      function attemptExplicitHydrationTarget(queuedTarget) {
        var targetInst = getClosestInstanceFromNode(queuedTarget.target);
        if (null !== targetInst) {
          var nearestMounted = getNearestMountedFiber(targetInst);
          if (null !== nearestMounted) {
            if (targetInst = nearestMounted.tag, 13 === targetInst) {
              if (targetInst = getSuspenseInstanceFromFiber(nearestMounted), null !== targetInst) {
                queuedTarget.blockedOn = targetInst;
                runWithPriority(queuedTarget.priority, function() {
                  if (13 === nearestMounted.tag) {
                    var lane = requestUpdateLane();
                    lane = getBumpedLaneForHydrationByLane(lane);
                    var root2 = enqueueConcurrentRenderForLane(nearestMounted, lane);
                    null !== root2 && scheduleUpdateOnFiber(root2, nearestMounted, lane);
                    markRetryLaneIfNotHydrated(nearestMounted, lane);
                  }
                });
                return;
              }
            } else if (3 === targetInst && nearestMounted.stateNode.current.memoizedState.isDehydrated) {
              queuedTarget.blockedOn = 3 === nearestMounted.tag ? nearestMounted.stateNode.containerInfo : null;
              return;
            }
          }
        }
        queuedTarget.blockedOn = null;
      }
      function attemptReplayContinuousQueuedEvent(queuedEvent) {
        if (null !== queuedEvent.blockedOn) return false;
        for (var targetContainers = queuedEvent.targetContainers; 0 < targetContainers.length; ) {
          var nextBlockedOn = findInstanceBlockingEvent(queuedEvent.nativeEvent);
          if (null === nextBlockedOn) {
            nextBlockedOn = queuedEvent.nativeEvent;
            var nativeEventClone = new nextBlockedOn.constructor(
              nextBlockedOn.type,
              nextBlockedOn
            );
            currentReplayingEvent = nativeEventClone;
            nextBlockedOn.target.dispatchEvent(nativeEventClone);
            currentReplayingEvent = null;
          } else
            return targetContainers = getInstanceFromNode(nextBlockedOn), null !== targetContainers && attemptContinuousHydration(targetContainers), queuedEvent.blockedOn = nextBlockedOn, false;
          targetContainers.shift();
        }
        return true;
      }
      function attemptReplayContinuousQueuedEventInMap(queuedEvent, key, map) {
        attemptReplayContinuousQueuedEvent(queuedEvent) && map.delete(key);
      }
      function replayUnblockedEvents() {
        hasScheduledReplayAttempt = false;
        null !== queuedFocus && attemptReplayContinuousQueuedEvent(queuedFocus) && (queuedFocus = null);
        null !== queuedDrag && attemptReplayContinuousQueuedEvent(queuedDrag) && (queuedDrag = null);
        null !== queuedMouse && attemptReplayContinuousQueuedEvent(queuedMouse) && (queuedMouse = null);
        queuedPointers.forEach(attemptReplayContinuousQueuedEventInMap);
        queuedPointerCaptures.forEach(attemptReplayContinuousQueuedEventInMap);
      }
      function scheduleCallbackIfUnblocked(queuedEvent, unblocked) {
        queuedEvent.blockedOn === unblocked && (queuedEvent.blockedOn = null, hasScheduledReplayAttempt || (hasScheduledReplayAttempt = true, Scheduler.unstable_scheduleCallback(
          Scheduler.unstable_NormalPriority,
          replayUnblockedEvents
        )));
      }
      var lastScheduledReplayQueue = null;
      function scheduleReplayQueueIfNeeded(formReplayingQueue) {
        lastScheduledReplayQueue !== formReplayingQueue && (lastScheduledReplayQueue = formReplayingQueue, Scheduler.unstable_scheduleCallback(
          Scheduler.unstable_NormalPriority,
          function() {
            lastScheduledReplayQueue === formReplayingQueue && (lastScheduledReplayQueue = null);
            for (var i = 0; i < formReplayingQueue.length; i += 3) {
              var form = formReplayingQueue[i], submitterOrAction = formReplayingQueue[i + 1], formData = formReplayingQueue[i + 2];
              if ("function" !== typeof submitterOrAction)
                if (null === findInstanceBlockingTarget(submitterOrAction || form))
                  continue;
                else break;
              var formInst = getInstanceFromNode(form);
              null !== formInst && (formReplayingQueue.splice(i, 3), i -= 3, startHostTransition(
                formInst,
                {
                  pending: true,
                  data: formData,
                  method: form.method,
                  action: submitterOrAction
                },
                submitterOrAction,
                formData
              ));
            }
          }
        ));
      }
      function retryIfBlockedOn(unblocked) {
        function unblock(queuedEvent) {
          return scheduleCallbackIfUnblocked(queuedEvent, unblocked);
        }
        null !== queuedFocus && scheduleCallbackIfUnblocked(queuedFocus, unblocked);
        null !== queuedDrag && scheduleCallbackIfUnblocked(queuedDrag, unblocked);
        null !== queuedMouse && scheduleCallbackIfUnblocked(queuedMouse, unblocked);
        queuedPointers.forEach(unblock);
        queuedPointerCaptures.forEach(unblock);
        for (var i = 0; i < queuedExplicitHydrationTargets.length; i++) {
          var queuedTarget = queuedExplicitHydrationTargets[i];
          queuedTarget.blockedOn === unblocked && (queuedTarget.blockedOn = null);
        }
        for (; 0 < queuedExplicitHydrationTargets.length && (i = queuedExplicitHydrationTargets[0], null === i.blockedOn); )
          attemptExplicitHydrationTarget(i), null === i.blockedOn && queuedExplicitHydrationTargets.shift();
        i = (unblocked.ownerDocument || unblocked).$$reactFormReplay;
        if (null != i)
          for (queuedTarget = 0; queuedTarget < i.length; queuedTarget += 3) {
            var form = i[queuedTarget], submitterOrAction = i[queuedTarget + 1], formProps = form[internalPropsKey] || null;
            if ("function" === typeof submitterOrAction)
              formProps || scheduleReplayQueueIfNeeded(i);
            else if (formProps) {
              var action = null;
              if (submitterOrAction && submitterOrAction.hasAttribute("formAction"))
                if (form = submitterOrAction, formProps = submitterOrAction[internalPropsKey] || null)
                  action = formProps.formAction;
                else {
                  if (null !== findInstanceBlockingTarget(form)) continue;
                }
              else action = formProps.action;
              "function" === typeof action ? i[queuedTarget + 1] = action : (i.splice(queuedTarget, 3), queuedTarget -= 3);
              scheduleReplayQueueIfNeeded(i);
            }
          }
      }
      function ReactDOMRoot(internalRoot) {
        this._internalRoot = internalRoot;
      }
      ReactDOMHydrationRoot.prototype.render = ReactDOMRoot.prototype.render = function(children) {
        var root2 = this._internalRoot;
        if (null === root2) throw Error(formatProdErrorMessage(409));
        var current = root2.current, lane = requestUpdateLane();
        updateContainerImpl(current, lane, children, root2, null, null);
      };
      ReactDOMHydrationRoot.prototype.unmount = ReactDOMRoot.prototype.unmount = function() {
        var root2 = this._internalRoot;
        if (null !== root2) {
          this._internalRoot = null;
          var container = root2.containerInfo;
          updateContainerImpl(root2.current, 2, null, root2, null, null);
          flushSyncWork$1();
          container[internalContainerInstanceKey] = null;
        }
      };
      function ReactDOMHydrationRoot(internalRoot) {
        this._internalRoot = internalRoot;
      }
      ReactDOMHydrationRoot.prototype.unstable_scheduleHydration = function(target) {
        if (target) {
          var updatePriority = resolveUpdatePriority();
          target = { blockedOn: null, target, priority: updatePriority };
          for (var i = 0; i < queuedExplicitHydrationTargets.length && 0 !== updatePriority && updatePriority < queuedExplicitHydrationTargets[i].priority; i++) ;
          queuedExplicitHydrationTargets.splice(i, 0, target);
          0 === i && attemptExplicitHydrationTarget(target);
        }
      };
      var isomorphicReactPackageVersion$jscomp$inline_1785 = React27.version;
      if ("19.1.0" !== isomorphicReactPackageVersion$jscomp$inline_1785)
        throw Error(
          formatProdErrorMessage(
            527,
            isomorphicReactPackageVersion$jscomp$inline_1785,
            "19.1.0"
          )
        );
      ReactDOMSharedInternals.findDOMNode = function(componentOrElement) {
        var fiber = componentOrElement._reactInternals;
        if (void 0 === fiber) {
          if ("function" === typeof componentOrElement.render)
            throw Error(formatProdErrorMessage(188));
          componentOrElement = Object.keys(componentOrElement).join(",");
          throw Error(formatProdErrorMessage(268, componentOrElement));
        }
        componentOrElement = findCurrentFiberUsingSlowPath(fiber);
        componentOrElement = null !== componentOrElement ? findCurrentHostFiberImpl(componentOrElement) : null;
        componentOrElement = null === componentOrElement ? null : componentOrElement.stateNode;
        return componentOrElement;
      };
      var internals$jscomp$inline_2256 = {
        bundleType: 0,
        version: "19.1.0",
        rendererPackageName: "react-dom",
        currentDispatcherRef: ReactSharedInternals,
        reconcilerVersion: "19.1.0"
      };
      if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
        hook$jscomp$inline_2257 = __REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (!hook$jscomp$inline_2257.isDisabled && hook$jscomp$inline_2257.supportsFiber)
          try {
            rendererID = hook$jscomp$inline_2257.inject(
              internals$jscomp$inline_2256
            ), injectedHook = hook$jscomp$inline_2257;
          } catch (err) {
          }
      }
      var hook$jscomp$inline_2257;
      exports.createRoot = function(container, options2) {
        if (!isValidContainer(container)) throw Error(formatProdErrorMessage(299));
        var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError, transitionCallbacks = null;
        null !== options2 && void 0 !== options2 && (true === options2.unstable_strictMode && (isStrictMode = true), void 0 !== options2.identifierPrefix && (identifierPrefix = options2.identifierPrefix), void 0 !== options2.onUncaughtError && (onUncaughtError = options2.onUncaughtError), void 0 !== options2.onCaughtError && (onCaughtError = options2.onCaughtError), void 0 !== options2.onRecoverableError && (onRecoverableError = options2.onRecoverableError), void 0 !== options2.unstable_transitionCallbacks && (transitionCallbacks = options2.unstable_transitionCallbacks));
        options2 = createFiberRoot(
          container,
          1,
          false,
          null,
          null,
          isStrictMode,
          identifierPrefix,
          onUncaughtError,
          onCaughtError,
          onRecoverableError,
          transitionCallbacks,
          null
        );
        container[internalContainerInstanceKey] = options2.current;
        listenToAllSupportedEvents(container);
        return new ReactDOMRoot(options2);
      };
      exports.hydrateRoot = function(container, initialChildren, options2) {
        if (!isValidContainer(container)) throw Error(formatProdErrorMessage(299));
        var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError, transitionCallbacks = null, formState = null;
        null !== options2 && void 0 !== options2 && (true === options2.unstable_strictMode && (isStrictMode = true), void 0 !== options2.identifierPrefix && (identifierPrefix = options2.identifierPrefix), void 0 !== options2.onUncaughtError && (onUncaughtError = options2.onUncaughtError), void 0 !== options2.onCaughtError && (onCaughtError = options2.onCaughtError), void 0 !== options2.onRecoverableError && (onRecoverableError = options2.onRecoverableError), void 0 !== options2.unstable_transitionCallbacks && (transitionCallbacks = options2.unstable_transitionCallbacks), void 0 !== options2.formState && (formState = options2.formState));
        initialChildren = createFiberRoot(
          container,
          1,
          true,
          initialChildren,
          null != options2 ? options2 : null,
          isStrictMode,
          identifierPrefix,
          onUncaughtError,
          onCaughtError,
          onRecoverableError,
          transitionCallbacks,
          formState
        );
        initialChildren.context = getContextForSubtree(null);
        options2 = initialChildren.current;
        isStrictMode = requestUpdateLane();
        isStrictMode = getBumpedLaneForHydrationByLane(isStrictMode);
        identifierPrefix = createUpdate(isStrictMode);
        identifierPrefix.callback = null;
        enqueueUpdate(options2, identifierPrefix, isStrictMode);
        options2 = isStrictMode;
        initialChildren.current.lanes = options2;
        markRootUpdated$1(initialChildren, options2);
        ensureRootIsScheduled(initialChildren);
        container[internalContainerInstanceKey] = initialChildren.current;
        listenToAllSupportedEvents(container);
        return new ReactDOMHydrationRoot(initialChildren);
      };
      exports.version = "19.1.0";
    }
  });

  // node_modules/react-dom/client.js
  var require_client = __commonJS({
    "node_modules/react-dom/client.js"(exports, module) {
      "use strict";
      function checkDCE() {
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
          return;
        }
        if (false) {
          throw new Error("^_^");
        }
        try {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
        } catch (err) {
          console.error(err);
        }
      }
      if (true) {
        checkDCE();
        module.exports = require_react_dom_client_production();
      } else {
        module.exports = null;
      }
    }
  });

  // node_modules/react-native-web/node_modules/@react-native/normalize-colors/index.js
  var require_normalize_colors = __commonJS({
    "node_modules/react-native-web/node_modules/@react-native/normalize-colors/index.js"(exports, module) {
      "use strict";
      function normalizeColor4(color) {
        if (typeof color === "number") {
          if (color >>> 0 === color && color >= 0 && color <= 4294967295) {
            return color;
          }
          return null;
        }
        if (typeof color !== "string") {
          return null;
        }
        const matchers = getMatchers();
        let match;
        if (match = matchers.hex6.exec(color)) {
          return parseInt(match[1] + "ff", 16) >>> 0;
        }
        const colorFromKeyword = normalizeKeyword(color);
        if (colorFromKeyword != null) {
          return colorFromKeyword;
        }
        if (match = matchers.rgb.exec(color)) {
          return (parse255(match[1]) << 24 | // r
          parse255(match[2]) << 16 | // g
          parse255(match[3]) << 8 | // b
          255) >>> // a
          0;
        }
        if (match = matchers.rgba.exec(color)) {
          if (match[6] !== void 0) {
            return (parse255(match[6]) << 24 | // r
            parse255(match[7]) << 16 | // g
            parse255(match[8]) << 8 | // b
            parse1(match[9])) >>> // a
            0;
          }
          return (parse255(match[2]) << 24 | // r
          parse255(match[3]) << 16 | // g
          parse255(match[4]) << 8 | // b
          parse1(match[5])) >>> // a
          0;
        }
        if (match = matchers.hex3.exec(color)) {
          return parseInt(
            match[1] + match[1] + // r
            match[2] + match[2] + // g
            match[3] + match[3] + // b
            "ff",
            // a
            16
          ) >>> 0;
        }
        if (match = matchers.hex8.exec(color)) {
          return parseInt(match[1], 16) >>> 0;
        }
        if (match = matchers.hex4.exec(color)) {
          return parseInt(
            match[1] + match[1] + // r
            match[2] + match[2] + // g
            match[3] + match[3] + // b
            match[4] + match[4],
            // a
            16
          ) >>> 0;
        }
        if (match = matchers.hsl.exec(color)) {
          return (hslToRgb(
            parse360(match[1]),
            // h
            parsePercentage(match[2]),
            // s
            parsePercentage(match[3])
            // l
          ) | 255) >>> // a
          0;
        }
        if (match = matchers.hsla.exec(color)) {
          if (match[6] !== void 0) {
            return (hslToRgb(
              parse360(match[6]),
              // h
              parsePercentage(match[7]),
              // s
              parsePercentage(match[8])
              // l
            ) | parse1(match[9])) >>> // a
            0;
          }
          return (hslToRgb(
            parse360(match[2]),
            // h
            parsePercentage(match[3]),
            // s
            parsePercentage(match[4])
            // l
          ) | parse1(match[5])) >>> // a
          0;
        }
        if (match = matchers.hwb.exec(color)) {
          return (hwbToRgb(
            parse360(match[1]),
            // h
            parsePercentage(match[2]),
            // w
            parsePercentage(match[3])
            // b
          ) | 255) >>> // a
          0;
        }
        return null;
      }
      function hue2rgb(p, q, t) {
        if (t < 0) {
          t += 1;
        }
        if (t > 1) {
          t -= 1;
        }
        if (t < 1 / 6) {
          return p + (q - p) * 6 * t;
        }
        if (t < 1 / 2) {
          return q;
        }
        if (t < 2 / 3) {
          return p + (q - p) * (2 / 3 - t) * 6;
        }
        return p;
      }
      function hslToRgb(h, s, l) {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = hue2rgb(p, q, h + 1 / 3);
        const g = hue2rgb(p, q, h);
        const b = hue2rgb(p, q, h - 1 / 3);
        return Math.round(r * 255) << 24 | Math.round(g * 255) << 16 | Math.round(b * 255) << 8;
      }
      function hwbToRgb(h, w2, b) {
        if (w2 + b >= 1) {
          const gray = Math.round(w2 * 255 / (w2 + b));
          return gray << 24 | gray << 16 | gray << 8;
        }
        const red = hue2rgb(0, 1, h + 1 / 3) * (1 - w2 - b) + w2;
        const green = hue2rgb(0, 1, h) * (1 - w2 - b) + w2;
        const blue = hue2rgb(0, 1, h - 1 / 3) * (1 - w2 - b) + w2;
        return Math.round(red * 255) << 24 | Math.round(green * 255) << 16 | Math.round(blue * 255) << 8;
      }
      var NUMBER = "[-+]?\\d*\\.?\\d+";
      var PERCENTAGE = NUMBER + "%";
      function call(...args) {
        return "\\(\\s*(" + args.join(")\\s*,?\\s*(") + ")\\s*\\)";
      }
      function callWithSlashSeparator(...args) {
        return "\\(\\s*(" + args.slice(0, args.length - 1).join(")\\s*,?\\s*(") + ")\\s*/\\s*(" + args[args.length - 1] + ")\\s*\\)";
      }
      function commaSeparatedCall(...args) {
        return "\\(\\s*(" + args.join(")\\s*,\\s*(") + ")\\s*\\)";
      }
      var cachedMatchers;
      function getMatchers() {
        if (cachedMatchers === void 0) {
          cachedMatchers = {
            rgb: new RegExp("rgb" + call(NUMBER, NUMBER, NUMBER)),
            rgba: new RegExp(
              "rgba(" + commaSeparatedCall(NUMBER, NUMBER, NUMBER, NUMBER) + "|" + callWithSlashSeparator(NUMBER, NUMBER, NUMBER, NUMBER) + ")"
            ),
            hsl: new RegExp("hsl" + call(NUMBER, PERCENTAGE, PERCENTAGE)),
            hsla: new RegExp(
              "hsla(" + commaSeparatedCall(NUMBER, PERCENTAGE, PERCENTAGE, NUMBER) + "|" + callWithSlashSeparator(NUMBER, PERCENTAGE, PERCENTAGE, NUMBER) + ")"
            ),
            hwb: new RegExp("hwb" + call(NUMBER, PERCENTAGE, PERCENTAGE)),
            hex3: /^#([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
            hex4: /^#([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
            hex6: /^#([0-9a-fA-F]{6})$/,
            hex8: /^#([0-9a-fA-F]{8})$/
          };
        }
        return cachedMatchers;
      }
      function parse255(str) {
        const int = parseInt(str, 10);
        if (int < 0) {
          return 0;
        }
        if (int > 255) {
          return 255;
        }
        return int;
      }
      function parse360(str) {
        const int = parseFloat(str);
        return (int % 360 + 360) % 360 / 360;
      }
      function parse1(str) {
        const num = parseFloat(str);
        if (num < 0) {
          return 0;
        }
        if (num > 1) {
          return 255;
        }
        return Math.round(num * 255);
      }
      function parsePercentage(str) {
        const int = parseFloat(str);
        if (int < 0) {
          return 0;
        }
        if (int > 100) {
          return 1;
        }
        return int / 100;
      }
      function normalizeKeyword(name) {
        switch (name) {
          case "transparent":
            return 0;
          // http://www.w3.org/TR/css3-color/#svg-color
          case "aliceblue":
            return 4042850303;
          case "antiquewhite":
            return 4209760255;
          case "aqua":
            return 16777215;
          case "aquamarine":
            return 2147472639;
          case "azure":
            return 4043309055;
          case "beige":
            return 4126530815;
          case "bisque":
            return 4293182719;
          case "black":
            return 255;
          case "blanchedalmond":
            return 4293643775;
          case "blue":
            return 65535;
          case "blueviolet":
            return 2318131967;
          case "brown":
            return 2771004159;
          case "burlywood":
            return 3736635391;
          case "burntsienna":
            return 3934150143;
          case "cadetblue":
            return 1604231423;
          case "chartreuse":
            return 2147418367;
          case "chocolate":
            return 3530104575;
          case "coral":
            return 4286533887;
          case "cornflowerblue":
            return 1687547391;
          case "cornsilk":
            return 4294499583;
          case "crimson":
            return 3692313855;
          case "cyan":
            return 16777215;
          case "darkblue":
            return 35839;
          case "darkcyan":
            return 9145343;
          case "darkgoldenrod":
            return 3095792639;
          case "darkgray":
            return 2846468607;
          case "darkgreen":
            return 6553855;
          case "darkgrey":
            return 2846468607;
          case "darkkhaki":
            return 3182914559;
          case "darkmagenta":
            return 2332068863;
          case "darkolivegreen":
            return 1433087999;
          case "darkorange":
            return 4287365375;
          case "darkorchid":
            return 2570243327;
          case "darkred":
            return 2332033279;
          case "darksalmon":
            return 3918953215;
          case "darkseagreen":
            return 2411499519;
          case "darkslateblue":
            return 1211993087;
          case "darkslategray":
            return 793726975;
          case "darkslategrey":
            return 793726975;
          case "darkturquoise":
            return 13554175;
          case "darkviolet":
            return 2483082239;
          case "deeppink":
            return 4279538687;
          case "deepskyblue":
            return 12582911;
          case "dimgray":
            return 1768516095;
          case "dimgrey":
            return 1768516095;
          case "dodgerblue":
            return 512819199;
          case "firebrick":
            return 2988581631;
          case "floralwhite":
            return 4294635775;
          case "forestgreen":
            return 579543807;
          case "fuchsia":
            return 4278255615;
          case "gainsboro":
            return 3705462015;
          case "ghostwhite":
            return 4177068031;
          case "gold":
            return 4292280575;
          case "goldenrod":
            return 3668254975;
          case "gray":
            return 2155905279;
          case "green":
            return 8388863;
          case "greenyellow":
            return 2919182335;
          case "grey":
            return 2155905279;
          case "honeydew":
            return 4043305215;
          case "hotpink":
            return 4285117695;
          case "indianred":
            return 3445382399;
          case "indigo":
            return 1258324735;
          case "ivory":
            return 4294963455;
          case "khaki":
            return 4041641215;
          case "lavender":
            return 3873897215;
          case "lavenderblush":
            return 4293981695;
          case "lawngreen":
            return 2096890111;
          case "lemonchiffon":
            return 4294626815;
          case "lightblue":
            return 2916673279;
          case "lightcoral":
            return 4034953471;
          case "lightcyan":
            return 3774873599;
          case "lightgoldenrodyellow":
            return 4210742015;
          case "lightgray":
            return 3553874943;
          case "lightgreen":
            return 2431553791;
          case "lightgrey":
            return 3553874943;
          case "lightpink":
            return 4290167295;
          case "lightsalmon":
            return 4288707327;
          case "lightseagreen":
            return 548580095;
          case "lightskyblue":
            return 2278488831;
          case "lightslategray":
            return 2005441023;
          case "lightslategrey":
            return 2005441023;
          case "lightsteelblue":
            return 2965692159;
          case "lightyellow":
            return 4294959359;
          case "lime":
            return 16711935;
          case "limegreen":
            return 852308735;
          case "linen":
            return 4210091775;
          case "magenta":
            return 4278255615;
          case "maroon":
            return 2147483903;
          case "mediumaquamarine":
            return 1724754687;
          case "mediumblue":
            return 52735;
          case "mediumorchid":
            return 3126187007;
          case "mediumpurple":
            return 2473647103;
          case "mediumseagreen":
            return 1018393087;
          case "mediumslateblue":
            return 2070474495;
          case "mediumspringgreen":
            return 16423679;
          case "mediumturquoise":
            return 1221709055;
          case "mediumvioletred":
            return 3340076543;
          case "midnightblue":
            return 421097727;
          case "mintcream":
            return 4127193855;
          case "mistyrose":
            return 4293190143;
          case "moccasin":
            return 4293178879;
          case "navajowhite":
            return 4292783615;
          case "navy":
            return 33023;
          case "oldlace":
            return 4260751103;
          case "olive":
            return 2155872511;
          case "olivedrab":
            return 1804477439;
          case "orange":
            return 4289003775;
          case "orangered":
            return 4282712319;
          case "orchid":
            return 3664828159;
          case "palegoldenrod":
            return 4008225535;
          case "palegreen":
            return 2566625535;
          case "paleturquoise":
            return 2951671551;
          case "palevioletred":
            return 3681588223;
          case "papayawhip":
            return 4293907967;
          case "peachpuff":
            return 4292524543;
          case "peru":
            return 3448061951;
          case "pink":
            return 4290825215;
          case "plum":
            return 3718307327;
          case "powderblue":
            return 2967529215;
          case "purple":
            return 2147516671;
          case "rebeccapurple":
            return 1714657791;
          case "red":
            return 4278190335;
          case "rosybrown":
            return 3163525119;
          case "royalblue":
            return 1097458175;
          case "saddlebrown":
            return 2336560127;
          case "salmon":
            return 4202722047;
          case "sandybrown":
            return 4104413439;
          case "seagreen":
            return 780883967;
          case "seashell":
            return 4294307583;
          case "sienna":
            return 2689740287;
          case "silver":
            return 3233857791;
          case "skyblue":
            return 2278484991;
          case "slateblue":
            return 1784335871;
          case "slategray":
            return 1887473919;
          case "slategrey":
            return 1887473919;
          case "snow":
            return 4294638335;
          case "springgreen":
            return 16744447;
          case "steelblue":
            return 1182971135;
          case "tan":
            return 3535047935;
          case "teal":
            return 8421631;
          case "thistle":
            return 3636451583;
          case "tomato":
            return 4284696575;
          case "turquoise":
            return 1088475391;
          case "violet":
            return 4001558271;
          case "wheat":
            return 4125012991;
          case "white":
            return 4294967295;
          case "whitesmoke":
            return 4126537215;
          case "yellow":
            return 4294902015;
          case "yellowgreen":
            return 2597139199;
        }
        return null;
      }
      module.exports = normalizeColor4;
    }
  });

  // node_modules/inline-style-prefixer/lib/utils/capitalizeString.js
  var require_capitalizeString = __commonJS({
    "node_modules/inline-style-prefixer/lib/utils/capitalizeString.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = capitalizeString;
      function capitalizeString(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
      }
    }
  });

  // node_modules/inline-style-prefixer/lib/utils/prefixProperty.js
  var require_prefixProperty = __commonJS({
    "node_modules/inline-style-prefixer/lib/utils/prefixProperty.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = prefixProperty;
      var _capitalizeString = require_capitalizeString();
      var _capitalizeString2 = _interopRequireDefault(_capitalizeString);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }
      function prefixProperty(prefixProperties, property, style) {
        var requiredPrefixes = prefixProperties[property];
        if (requiredPrefixes && style.hasOwnProperty(property)) {
          var capitalizedProperty = (0, _capitalizeString2.default)(property);
          for (var i = 0; i < requiredPrefixes.length; ++i) {
            var prefixedProperty = requiredPrefixes[i] + capitalizedProperty;
            if (!style[prefixedProperty]) {
              style[prefixedProperty] = style[property];
            }
          }
        }
        return style;
      }
    }
  });

  // node_modules/inline-style-prefixer/lib/utils/prefixValue.js
  var require_prefixValue = __commonJS({
    "node_modules/inline-style-prefixer/lib/utils/prefixValue.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = prefixValue;
      function prefixValue(plugins, property, value, style, metaData) {
        for (var i = 0, len = plugins.length; i < len; ++i) {
          var processedValue = plugins[i](property, value, style, metaData);
          if (processedValue) {
            return processedValue;
          }
        }
      }
    }
  });

  // node_modules/inline-style-prefixer/lib/utils/addNewValuesOnly.js
  var require_addNewValuesOnly = __commonJS({
    "node_modules/inline-style-prefixer/lib/utils/addNewValuesOnly.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = addNewValuesOnly;
      function addIfNew(list, value) {
        if (list.indexOf(value) === -1) {
          list.push(value);
        }
      }
      function addNewValuesOnly(list, values) {
        if (Array.isArray(values)) {
          for (var i = 0, len = values.length; i < len; ++i) {
            addIfNew(list, values[i]);
          }
        } else {
          addIfNew(list, values);
        }
      }
    }
  });

  // node_modules/inline-style-prefixer/lib/utils/isObject.js
  var require_isObject = __commonJS({
    "node_modules/inline-style-prefixer/lib/utils/isObject.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = isObject;
      function isObject(value) {
        return value instanceof Object && !Array.isArray(value);
      }
    }
  });

  // node_modules/inline-style-prefixer/lib/createPrefixer.js
  var require_createPrefixer = __commonJS({
    "node_modules/inline-style-prefixer/lib/createPrefixer.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = createPrefixer2;
      var _prefixProperty = require_prefixProperty();
      var _prefixProperty2 = _interopRequireDefault(_prefixProperty);
      var _prefixValue = require_prefixValue();
      var _prefixValue2 = _interopRequireDefault(_prefixValue);
      var _addNewValuesOnly = require_addNewValuesOnly();
      var _addNewValuesOnly2 = _interopRequireDefault(_addNewValuesOnly);
      var _isObject = require_isObject();
      var _isObject2 = _interopRequireDefault(_isObject);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }
      function createPrefixer2(_ref) {
        var prefixMap = _ref.prefixMap, plugins = _ref.plugins;
        return function prefix(style) {
          for (var property in style) {
            var value = style[property];
            if ((0, _isObject2.default)(value)) {
              style[property] = prefix(value);
            } else if (Array.isArray(value)) {
              var combinedValue = [];
              for (var i = 0, len = value.length; i < len; ++i) {
                var processedValue = (0, _prefixValue2.default)(plugins, property, value[i], style, prefixMap);
                (0, _addNewValuesOnly2.default)(combinedValue, processedValue || value[i]);
              }
              if (combinedValue.length > 0) {
                style[property] = combinedValue;
              }
            } else {
              var _processedValue = (0, _prefixValue2.default)(plugins, property, value, style, prefixMap);
              if (_processedValue) {
                style[property] = _processedValue;
              }
              style = (0, _prefixProperty2.default)(prefixMap, property, style);
            }
          }
          return style;
        };
      }
    }
  });

  // node_modules/css-in-js-utils/lib/assignStyle.js
  var require_assignStyle = __commonJS({
    "node_modules/css-in-js-utils/lib/assignStyle.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = assignStyle;
      function _typeof2(obj) {
        "@babel/helpers - typeof";
        if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
          _typeof2 = function _typeof3(obj2) {
            return typeof obj2;
          };
        } else {
          _typeof2 = function _typeof3(obj2) {
            return obj2 && typeof Symbol === "function" && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
          };
        }
        return _typeof2(obj);
      }
      function _toConsumableArray(arr) {
        return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray2(arr) || _nonIterableSpread();
      }
      function _nonIterableSpread() {
        throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
      }
      function _unsupportedIterableToArray2(o, minLen) {
        if (!o) return;
        if (typeof o === "string") return _arrayLikeToArray2(o, minLen);
        var n = Object.prototype.toString.call(o).slice(8, -1);
        if (n === "Object" && o.constructor) n = o.constructor.name;
        if (n === "Map" || n === "Set") return Array.from(n);
        if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray2(o, minLen);
      }
      function _iterableToArray(iter) {
        if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
      }
      function _arrayWithoutHoles(arr) {
        if (Array.isArray(arr)) return _arrayLikeToArray2(arr);
      }
      function _arrayLikeToArray2(arr, len) {
        if (len == null || len > arr.length) len = arr.length;
        for (var i = 0, arr2 = new Array(len); i < len; i++) {
          arr2[i] = arr[i];
        }
        return arr2;
      }
      function filterUniqueArray(arr) {
        return arr.filter(function(val, index) {
          return arr.lastIndexOf(val) === index;
        });
      }
      function assignStyle(base) {
        for (var i = 0, len = arguments.length <= 1 ? 0 : arguments.length - 1; i < len; ++i) {
          var style = i + 1 < 1 || arguments.length <= i + 1 ? void 0 : arguments[i + 1];
          for (var property in style) {
            var value = style[property];
            var baseValue = base[property];
            if (baseValue && value) {
              if (Array.isArray(baseValue)) {
                base[property] = filterUniqueArray(baseValue.concat(value));
                continue;
              }
              if (Array.isArray(value)) {
                base[property] = filterUniqueArray([baseValue].concat(_toConsumableArray(value)));
                continue;
              }
              if (_typeof2(value) === "object") {
                base[property] = assignStyle({}, baseValue, value);
                continue;
              }
            }
            base[property] = value;
          }
        }
        return base;
      }
    }
  });

  // node_modules/css-in-js-utils/lib/camelCaseProperty.js
  var require_camelCaseProperty = __commonJS({
    "node_modules/css-in-js-utils/lib/camelCaseProperty.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = camelCaseProperty;
      var DASH = /-([a-z])/g;
      var MS = /^Ms/g;
      var cache4 = {};
      function toUpper(match) {
        return match[1].toUpperCase();
      }
      function camelCaseProperty(property) {
        if (cache4.hasOwnProperty(property)) {
          return cache4[property];
        }
        var camelProp = property.replace(DASH, toUpper).replace(MS, "ms");
        cache4[property] = camelProp;
        return camelProp;
      }
    }
  });

  // node_modules/hyphenate-style-name/index.cjs.js
  var require_index_cjs = __commonJS({
    "node_modules/hyphenate-style-name/index.cjs.js"(exports, module) {
      "use strict";
      var uppercasePattern3 = /[A-Z]/g;
      var msPattern2 = /^ms-/;
      var cache4 = {};
      function toHyphenLower3(match) {
        return "-" + match.toLowerCase();
      }
      function hyphenateStyleName2(name) {
        if (cache4.hasOwnProperty(name)) {
          return cache4[name];
        }
        var hName = name.replace(uppercasePattern3, toHyphenLower3);
        return cache4[name] = msPattern2.test(hName) ? "-" + hName : hName;
      }
      module.exports = hyphenateStyleName2;
    }
  });

  // node_modules/css-in-js-utils/lib/hyphenateProperty.js
  var require_hyphenateProperty = __commonJS({
    "node_modules/css-in-js-utils/lib/hyphenateProperty.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = hyphenateProperty;
      var _hyphenateStyleName = require_index_cjs();
      var _hyphenateStyleName2 = _interopRequireDefault(_hyphenateStyleName);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { "default": obj };
      }
      function hyphenateProperty(property) {
        return (0, _hyphenateStyleName2["default"])(property);
      }
    }
  });

  // node_modules/css-in-js-utils/lib/cssifyDeclaration.js
  var require_cssifyDeclaration = __commonJS({
    "node_modules/css-in-js-utils/lib/cssifyDeclaration.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = cssifyDeclaration;
      var _hyphenateProperty = require_hyphenateProperty();
      var _hyphenateProperty2 = _interopRequireDefault(_hyphenateProperty);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { "default": obj };
      }
      function cssifyDeclaration(property, value) {
        return (0, _hyphenateProperty2["default"])(property) + ":" + value;
      }
    }
  });

  // node_modules/css-in-js-utils/lib/cssifyObject.js
  var require_cssifyObject = __commonJS({
    "node_modules/css-in-js-utils/lib/cssifyObject.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = cssifyObject;
      var _cssifyDeclaration = require_cssifyDeclaration();
      var _cssifyDeclaration2 = _interopRequireDefault(_cssifyDeclaration);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { "default": obj };
      }
      function cssifyObject(style) {
        var css = "";
        for (var property in style) {
          var value = style[property];
          if (typeof value !== "string" && typeof value !== "number") {
            continue;
          }
          if (css) {
            css += ";";
          }
          css += (0, _cssifyDeclaration2["default"])(property, value);
        }
        return css;
      }
    }
  });

  // node_modules/css-in-js-utils/lib/isPrefixedProperty.js
  var require_isPrefixedProperty = __commonJS({
    "node_modules/css-in-js-utils/lib/isPrefixedProperty.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = isPrefixedProperty;
      var RE = /^(Webkit|Moz|O|ms)/;
      function isPrefixedProperty(property) {
        return RE.test(property);
      }
    }
  });

  // node_modules/css-in-js-utils/lib/isPrefixedValue.js
  var require_isPrefixedValue = __commonJS({
    "node_modules/css-in-js-utils/lib/isPrefixedValue.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = isPrefixedValue;
      var RE = /-webkit-|-moz-|-ms-/;
      function isPrefixedValue(value) {
        return typeof value === "string" && RE.test(value);
      }
    }
  });

  // node_modules/css-in-js-utils/lib/isUnitlessProperty.js
  var require_isUnitlessProperty = __commonJS({
    "node_modules/css-in-js-utils/lib/isUnitlessProperty.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = isUnitlessProperty;
      var _hyphenateProperty = require_hyphenateProperty();
      var _hyphenateProperty2 = _interopRequireDefault(_hyphenateProperty);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { "default": obj };
      }
      var unitlessProperties = {
        borderImageOutset: true,
        borderImageSlice: true,
        borderImageWidth: true,
        fontWeight: true,
        lineHeight: true,
        opacity: true,
        orphans: true,
        tabSize: true,
        widows: true,
        zIndex: true,
        zoom: true,
        // SVG-related properties
        fillOpacity: true,
        floodOpacity: true,
        stopOpacity: true,
        strokeDasharray: true,
        strokeDashoffset: true,
        strokeMiterlimit: true,
        strokeOpacity: true,
        strokeWidth: true
      };
      var prefixedUnitlessProperties = ["animationIterationCount", "boxFlex", "boxFlexGroup", "boxOrdinalGroup", "columnCount", "flex", "flexGrow", "flexPositive", "flexShrink", "flexNegative", "flexOrder", "gridColumn", "gridColumnEnd", "gridColumnStart", "gridRow", "gridRowEnd", "gridRowStart", "lineClamp", "order"];
      var prefixes3 = ["Webkit", "ms", "Moz", "O"];
      function getPrefixedProperty(prefix, property2) {
        return prefix + property2.charAt(0).toUpperCase() + property2.slice(1);
      }
      for (i = 0, len = prefixedUnitlessProperties.length; i < len; ++i) {
        property = prefixedUnitlessProperties[i];
        unitlessProperties[property] = true;
        for (j = 0, jLen = prefixes3.length; j < jLen; ++j) {
          unitlessProperties[getPrefixedProperty(prefixes3[j], property)] = true;
        }
      }
      var property;
      var j;
      var jLen;
      var i;
      var len;
      for (_property in unitlessProperties) {
        unitlessProperties[(0, _hyphenateProperty2["default"])(_property)] = true;
      }
      var _property;
      function isUnitlessProperty(property2) {
        return unitlessProperties.hasOwnProperty(property2);
      }
    }
  });

  // node_modules/css-in-js-utils/lib/unprefixProperty.js
  var require_unprefixProperty = __commonJS({
    "node_modules/css-in-js-utils/lib/unprefixProperty.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = unprefixProperty;
      var RE = /^(ms|Webkit|Moz|O)/;
      function unprefixProperty(property) {
        var propertyWithoutPrefix = property.replace(RE, "");
        return propertyWithoutPrefix.charAt(0).toLowerCase() + propertyWithoutPrefix.slice(1);
      }
    }
  });

  // node_modules/css-in-js-utils/lib/normalizeProperty.js
  var require_normalizeProperty = __commonJS({
    "node_modules/css-in-js-utils/lib/normalizeProperty.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = normalizeProperty;
      var _camelCaseProperty = require_camelCaseProperty();
      var _camelCaseProperty2 = _interopRequireDefault(_camelCaseProperty);
      var _unprefixProperty = require_unprefixProperty();
      var _unprefixProperty2 = _interopRequireDefault(_unprefixProperty);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { "default": obj };
      }
      function normalizeProperty(property) {
        return (0, _unprefixProperty2["default"])((0, _camelCaseProperty2["default"])(property));
      }
    }
  });

  // node_modules/css-in-js-utils/lib/resolveArrayValue.js
  var require_resolveArrayValue = __commonJS({
    "node_modules/css-in-js-utils/lib/resolveArrayValue.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = resolveArrayValue;
      var _hyphenateProperty = require_hyphenateProperty();
      var _hyphenateProperty2 = _interopRequireDefault(_hyphenateProperty);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { "default": obj };
      }
      function resolveArrayValue(property, value) {
        return value.join(";" + (0, _hyphenateProperty2["default"])(property) + ":");
      }
    }
  });

  // node_modules/css-in-js-utils/lib/unprefixValue.js
  var require_unprefixValue = __commonJS({
    "node_modules/css-in-js-utils/lib/unprefixValue.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports["default"] = unprefixValue;
      var RE = /(-ms-|-webkit-|-moz-|-o-)/g;
      function unprefixValue(value) {
        if (typeof value === "string") {
          return value.replace(RE, "");
        }
        return value;
      }
    }
  });

  // node_modules/css-in-js-utils/lib/index.js
  var require_lib = __commonJS({
    "node_modules/css-in-js-utils/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.unprefixValue = exports.unprefixProperty = exports.resolveArrayValue = exports.normalizeProperty = exports.isUnitlessProperty = exports.isPrefixedValue = exports.isPrefixedProperty = exports.hyphenateProperty = exports.cssifyObject = exports.cssifyDeclaration = exports.camelCaseProperty = exports.assignStyle = void 0;
      var _assignStyle = require_assignStyle();
      var _assignStyle2 = _interopRequireDefault(_assignStyle);
      var _camelCaseProperty = require_camelCaseProperty();
      var _camelCaseProperty2 = _interopRequireDefault(_camelCaseProperty);
      var _cssifyDeclaration = require_cssifyDeclaration();
      var _cssifyDeclaration2 = _interopRequireDefault(_cssifyDeclaration);
      var _cssifyObject = require_cssifyObject();
      var _cssifyObject2 = _interopRequireDefault(_cssifyObject);
      var _hyphenateProperty = require_hyphenateProperty();
      var _hyphenateProperty2 = _interopRequireDefault(_hyphenateProperty);
      var _isPrefixedProperty = require_isPrefixedProperty();
      var _isPrefixedProperty2 = _interopRequireDefault(_isPrefixedProperty);
      var _isPrefixedValue = require_isPrefixedValue();
      var _isPrefixedValue2 = _interopRequireDefault(_isPrefixedValue);
      var _isUnitlessProperty = require_isUnitlessProperty();
      var _isUnitlessProperty2 = _interopRequireDefault(_isUnitlessProperty);
      var _normalizeProperty = require_normalizeProperty();
      var _normalizeProperty2 = _interopRequireDefault(_normalizeProperty);
      var _resolveArrayValue = require_resolveArrayValue();
      var _resolveArrayValue2 = _interopRequireDefault(_resolveArrayValue);
      var _unprefixProperty = require_unprefixProperty();
      var _unprefixProperty2 = _interopRequireDefault(_unprefixProperty);
      var _unprefixValue = require_unprefixValue();
      var _unprefixValue2 = _interopRequireDefault(_unprefixValue);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { "default": obj };
      }
      exports.assignStyle = _assignStyle2["default"];
      exports.camelCaseProperty = _camelCaseProperty2["default"];
      exports.cssifyDeclaration = _cssifyDeclaration2["default"];
      exports.cssifyObject = _cssifyObject2["default"];
      exports.hyphenateProperty = _hyphenateProperty2["default"];
      exports.isPrefixedProperty = _isPrefixedProperty2["default"];
      exports.isPrefixedValue = _isPrefixedValue2["default"];
      exports.isUnitlessProperty = _isUnitlessProperty2["default"];
      exports.normalizeProperty = _normalizeProperty2["default"];
      exports.resolveArrayValue = _resolveArrayValue2["default"];
      exports.unprefixProperty = _unprefixProperty2["default"];
      exports.unprefixValue = _unprefixValue2["default"];
    }
  });

  // node_modules/inline-style-prefixer/lib/plugins/crossFade.js
  var require_crossFade = __commonJS({
    "node_modules/inline-style-prefixer/lib/plugins/crossFade.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = crossFade2;
      var _cssInJsUtils = require_lib();
      var CROSS_FADE_REGEX = /cross-fade\(/g;
      var prefixes3 = ["-webkit-", ""];
      function crossFade2(property, value) {
        if (typeof value === "string" && !(0, _cssInJsUtils.isPrefixedValue)(value) && value.indexOf("cross-fade(") !== -1) {
          return prefixes3.map(function(prefix) {
            return value.replace(CROSS_FADE_REGEX, prefix + "cross-fade(");
          });
        }
      }
    }
  });

  // node_modules/inline-style-prefixer/lib/plugins/imageSet.js
  var require_imageSet = __commonJS({
    "node_modules/inline-style-prefixer/lib/plugins/imageSet.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = imageSet2;
      var _isPrefixedValue = require_isPrefixedValue();
      var _isPrefixedValue2 = _interopRequireDefault(_isPrefixedValue);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }
      var prefixes3 = ["-webkit-", ""];
      function imageSet2(property, value) {
        if (typeof value === "string" && !(0, _isPrefixedValue2.default)(value) && value.indexOf("image-set(") > -1) {
          return prefixes3.map(function(prefix) {
            return value.replace(/image-set\(/g, prefix + "image-set(");
          });
        }
      }
    }
  });

  // node_modules/inline-style-prefixer/lib/plugins/logical.js
  var require_logical = __commonJS({
    "node_modules/inline-style-prefixer/lib/plugins/logical.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = logical2;
      var alternativeProps = {
        marginBlockStart: ["WebkitMarginBefore"],
        marginBlockEnd: ["WebkitMarginAfter"],
        marginInlineStart: ["WebkitMarginStart", "MozMarginStart"],
        marginInlineEnd: ["WebkitMarginEnd", "MozMarginEnd"],
        paddingBlockStart: ["WebkitPaddingBefore"],
        paddingBlockEnd: ["WebkitPaddingAfter"],
        paddingInlineStart: ["WebkitPaddingStart", "MozPaddingStart"],
        paddingInlineEnd: ["WebkitPaddingEnd", "MozPaddingEnd"],
        borderBlockStart: ["WebkitBorderBefore"],
        borderBlockStartColor: ["WebkitBorderBeforeColor"],
        borderBlockStartStyle: ["WebkitBorderBeforeStyle"],
        borderBlockStartWidth: ["WebkitBorderBeforeWidth"],
        borderBlockEnd: ["WebkitBorderAfter"],
        borderBlockEndColor: ["WebkitBorderAfterColor"],
        borderBlockEndStyle: ["WebkitBorderAfterStyle"],
        borderBlockEndWidth: ["WebkitBorderAfterWidth"],
        borderInlineStart: ["WebkitBorderStart", "MozBorderStart"],
        borderInlineStartColor: ["WebkitBorderStartColor", "MozBorderStartColor"],
        borderInlineStartStyle: ["WebkitBorderStartStyle", "MozBorderStartStyle"],
        borderInlineStartWidth: ["WebkitBorderStartWidth", "MozBorderStartWidth"],
        borderInlineEnd: ["WebkitBorderEnd", "MozBorderEnd"],
        borderInlineEndColor: ["WebkitBorderEndColor", "MozBorderEndColor"],
        borderInlineEndStyle: ["WebkitBorderEndStyle", "MozBorderEndStyle"],
        borderInlineEndWidth: ["WebkitBorderEndWidth", "MozBorderEndWidth"]
      };
      function logical2(property, value, style) {
        if (Object.prototype.hasOwnProperty.call(alternativeProps, property)) {
          var alternativePropList = alternativeProps[property];
          for (var i = 0, len = alternativePropList.length; i < len; ++i) {
            style[alternativePropList[i]] = value;
          }
        }
      }
    }
  });

  // node_modules/inline-style-prefixer/lib/plugins/position.js
  var require_position = __commonJS({
    "node_modules/inline-style-prefixer/lib/plugins/position.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = position2;
      function position2(property, value) {
        if (property === "position" && value === "sticky") {
          return ["-webkit-sticky", "sticky"];
        }
      }
    }
  });

  // node_modules/inline-style-prefixer/lib/plugins/sizing.js
  var require_sizing = __commonJS({
    "node_modules/inline-style-prefixer/lib/plugins/sizing.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = sizing2;
      var prefixes3 = ["-webkit-", "-moz-", ""];
      var properties = {
        maxHeight: true,
        maxWidth: true,
        width: true,
        height: true,
        columnWidth: true,
        minWidth: true,
        minHeight: true
      };
      var values = {
        "min-content": true,
        "max-content": true,
        "fill-available": true,
        "fit-content": true,
        "contain-floats": true
      };
      function sizing2(property, value) {
        if (properties.hasOwnProperty(property) && values.hasOwnProperty(value)) {
          return prefixes3.map(function(prefix) {
            return prefix + value;
          });
        }
      }
    }
  });

  // node_modules/inline-style-prefixer/lib/plugins/transition.js
  var require_transition = __commonJS({
    "node_modules/inline-style-prefixer/lib/plugins/transition.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.default = transition2;
      var _hyphenateProperty = require_hyphenateProperty();
      var _hyphenateProperty2 = _interopRequireDefault(_hyphenateProperty);
      var _isPrefixedValue = require_isPrefixedValue();
      var _isPrefixedValue2 = _interopRequireDefault(_isPrefixedValue);
      var _capitalizeString = require_capitalizeString();
      var _capitalizeString2 = _interopRequireDefault(_capitalizeString);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }
      var properties = {
        transition: true,
        transitionProperty: true,
        WebkitTransition: true,
        WebkitTransitionProperty: true,
        MozTransition: true,
        MozTransitionProperty: true
      };
      var prefixMapping = {
        Webkit: "-webkit-",
        Moz: "-moz-",
        ms: "-ms-"
      };
      function prefixValue(value, propertyPrefixMap) {
        if ((0, _isPrefixedValue2.default)(value)) {
          return value;
        }
        var multipleValues = value.split(/,(?![^()]*(?:\([^()]*\))?\))/g);
        for (var i = 0, len = multipleValues.length; i < len; ++i) {
          var singleValue = multipleValues[i];
          var values = [singleValue];
          for (var property in propertyPrefixMap) {
            var dashCaseProperty = (0, _hyphenateProperty2.default)(property);
            if (singleValue.indexOf(dashCaseProperty) > -1 && dashCaseProperty !== "order") {
              var prefixes3 = propertyPrefixMap[property];
              for (var j = 0, pLen = prefixes3.length; j < pLen; ++j) {
                values.unshift(singleValue.replace(dashCaseProperty, prefixMapping[prefixes3[j]] + dashCaseProperty));
              }
            }
          }
          multipleValues[i] = values.join(",");
        }
        return multipleValues.join(",");
      }
      function transition2(property, value, style, propertyPrefixMap) {
        if (typeof value === "string" && properties.hasOwnProperty(property)) {
          var outputValue = prefixValue(value, propertyPrefixMap);
          var webkitOutput = outputValue.split(/,(?![^()]*(?:\([^()]*\))?\))/g).filter(function(val) {
            return !/-moz-|-ms-/.test(val);
          }).join(",");
          if (property.indexOf("Webkit") > -1) {
            return webkitOutput;
          }
          var mozOutput = outputValue.split(/,(?![^()]*(?:\([^()]*\))?\))/g).filter(function(val) {
            return !/-webkit-|-ms-/.test(val);
          }).join(",");
          if (property.indexOf("Moz") > -1) {
            return mozOutput;
          }
          style["Webkit" + (0, _capitalizeString2.default)(property)] = webkitOutput;
          style["Moz" + (0, _capitalizeString2.default)(property)] = mozOutput;
          return outputValue;
        }
      }
    }
  });

  // node_modules/styleq/dist/transform-localize-style.js
  var require_transform_localize_style = __commonJS({
    "node_modules/styleq/dist/transform-localize-style.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.localizeStyle = localizeStyle2;
      var cache4 = /* @__PURE__ */ new WeakMap();
      var markerProp = "$$css$localize";
      function compileStyle(style, isRTL) {
        var compiledStyle = {};
        for (var prop in style) {
          if (prop !== markerProp) {
            var value = style[prop];
            if (Array.isArray(value)) {
              compiledStyle[prop] = isRTL ? value[1] : value[0];
            } else {
              compiledStyle[prop] = value;
            }
          }
        }
        return compiledStyle;
      }
      function localizeStyle2(style, isRTL) {
        if (style[markerProp] != null) {
          var compiledStyleIndex = isRTL ? 1 : 0;
          if (cache4.has(style)) {
            var _cachedStyles = cache4.get(style);
            var _compiledStyle = _cachedStyles[compiledStyleIndex];
            if (_compiledStyle == null) {
              _compiledStyle = compileStyle(style, isRTL);
              _cachedStyles[compiledStyleIndex] = _compiledStyle;
              cache4.set(style, _cachedStyles);
            }
            return _compiledStyle;
          }
          var compiledStyle = compileStyle(style, isRTL);
          var cachedStyles = new Array(2);
          cachedStyles[compiledStyleIndex] = compiledStyle;
          cache4.set(style, cachedStyles);
          return compiledStyle;
        }
        return style;
      }
    }
  });

  // node_modules/styleq/transform-localize-style.js
  var require_transform_localize_style2 = __commonJS({
    "node_modules/styleq/transform-localize-style.js"(exports, module) {
      module.exports = require_transform_localize_style();
    }
  });

  // node_modules/styleq/dist/styleq.js
  var require_styleq = __commonJS({
    "node_modules/styleq/dist/styleq.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.styleq = void 0;
      var cache4 = /* @__PURE__ */ new WeakMap();
      var compiledKey = "$$css";
      function createStyleq(options) {
        var disableCache;
        var disableMix;
        var transform;
        if (options != null) {
          disableCache = options.disableCache === true;
          disableMix = options.disableMix === true;
          transform = options.transform;
        }
        return function styleq3() {
          var definedProperties = [];
          var className = "";
          var inlineStyle = null;
          var nextCache = disableCache ? null : cache4;
          var styles16 = new Array(arguments.length);
          for (var i = 0; i < arguments.length; i++) {
            styles16[i] = arguments[i];
          }
          while (styles16.length > 0) {
            var possibleStyle = styles16.pop();
            if (possibleStyle == null || possibleStyle === false) {
              continue;
            }
            if (Array.isArray(possibleStyle)) {
              for (var _i = 0; _i < possibleStyle.length; _i++) {
                styles16.push(possibleStyle[_i]);
              }
              continue;
            }
            var style = transform != null ? transform(possibleStyle) : possibleStyle;
            if (style.$$css) {
              var classNameChunk = "";
              if (nextCache != null && nextCache.has(style)) {
                var cacheEntry = nextCache.get(style);
                if (cacheEntry != null) {
                  classNameChunk = cacheEntry[0];
                  definedProperties.push.apply(definedProperties, cacheEntry[1]);
                  nextCache = cacheEntry[2];
                }
              } else {
                var definedPropertiesChunk = [];
                for (var prop in style) {
                  var value = style[prop];
                  if (prop === compiledKey) continue;
                  if (typeof value === "string" || value === null) {
                    if (!definedProperties.includes(prop)) {
                      definedProperties.push(prop);
                      if (nextCache != null) {
                        definedPropertiesChunk.push(prop);
                      }
                      if (typeof value === "string") {
                        classNameChunk += classNameChunk ? " " + value : value;
                      }
                    }
                  } else {
                    console.error("styleq: ".concat(prop, " typeof ").concat(String(value), ' is not "string" or "null".'));
                  }
                }
                if (nextCache != null) {
                  var weakMap = /* @__PURE__ */ new WeakMap();
                  nextCache.set(style, [classNameChunk, definedPropertiesChunk, weakMap]);
                  nextCache = weakMap;
                }
              }
              if (classNameChunk) {
                className = className ? classNameChunk + " " + className : classNameChunk;
              }
            } else {
              if (disableMix) {
                if (inlineStyle == null) {
                  inlineStyle = {};
                }
                inlineStyle = Object.assign({}, style, inlineStyle);
              } else {
                var subStyle = null;
                for (var _prop in style) {
                  var _value = style[_prop];
                  if (_value !== void 0) {
                    if (!definedProperties.includes(_prop)) {
                      if (_value != null) {
                        if (inlineStyle == null) {
                          inlineStyle = {};
                        }
                        if (subStyle == null) {
                          subStyle = {};
                        }
                        subStyle[_prop] = _value;
                      }
                      definedProperties.push(_prop);
                      nextCache = null;
                    }
                  }
                }
                if (subStyle != null) {
                  inlineStyle = Object.assign(subStyle, inlineStyle);
                }
              }
            }
          }
          var styleProps2 = [className, inlineStyle];
          return styleProps2;
        };
      }
      var styleq2 = createStyleq();
      exports.styleq = styleq2;
      styleq2.factory = createStyleq;
    }
  });

  // node_modules/fbjs/lib/invariant.js
  var require_invariant = __commonJS({
    "node_modules/fbjs/lib/invariant.js"(exports, module) {
      "use strict";
      var validateFormat = false ? function(format) {
        if (format === void 0) {
          throw new Error("invariant(...): Second argument must be a string.");
        }
      } : function(format) {
      };
      function invariant12(condition, format) {
        for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
          args[_key - 2] = arguments[_key];
        }
        validateFormat(format);
        if (!condition) {
          var error;
          if (format === void 0) {
            error = new Error("Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings.");
          } else {
            var argIndex = 0;
            error = new Error(format.replace(/%s/g, function() {
              return String(args[argIndex++]);
            }));
            error.name = "Invariant Violation";
          }
          error.framesToPop = 1;
          throw error;
        }
      }
      module.exports = invariant12;
    }
  });

  // node_modules/fbjs/lib/emptyFunction.js
  var require_emptyFunction = __commonJS({
    "node_modules/fbjs/lib/emptyFunction.js"(exports, module) {
      "use strict";
      function makeEmptyFunction(arg) {
        return function() {
          return arg;
        };
      }
      var emptyFunction3 = function emptyFunction4() {
      };
      emptyFunction3.thatReturns = makeEmptyFunction;
      emptyFunction3.thatReturnsFalse = makeEmptyFunction(false);
      emptyFunction3.thatReturnsTrue = makeEmptyFunction(true);
      emptyFunction3.thatReturnsNull = makeEmptyFunction(null);
      emptyFunction3.thatReturnsThis = function() {
        return this;
      };
      emptyFunction3.thatReturnsArgument = function(arg) {
        return arg;
      };
      module.exports = emptyFunction3;
    }
  });

  // node_modules/fbjs/lib/warning.js
  var require_warning = __commonJS({
    "node_modules/fbjs/lib/warning.js"(exports, module) {
      "use strict";
      var emptyFunction3 = require_emptyFunction();
      var warning2 = false ? function(condition, format) {
        if (format === void 0) {
          throw new Error("`warning(condition, format, ...args)` requires a warning message argument");
        }
        if (!condition) {
          for (var _len2 = arguments.length, args = new Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
            args[_key2 - 2] = arguments[_key2];
          }
          printWarning.apply(void 0, [format].concat(args));
        }
      } : emptyFunction3;
      module.exports = warning2;
    }
  });

  // node_modules/nullthrows/nullthrows.js
  var require_nullthrows = __commonJS({
    "node_modules/nullthrows/nullthrows.js"(exports, module) {
      "use strict";
      function nullthrows2(x, message) {
        if (x != null) {
          return x;
        }
        var error = new Error(message !== void 0 ? message : "Got unexpected " + x);
        error.framesToPop = 1;
        throw error;
      }
      module.exports = nullthrows2;
      module.exports.default = nullthrows2;
      Object.defineProperty(module.exports, "__esModule", { value: true });
    }
  });

  // node_modules/is-plain-obj/index.js
  var require_is_plain_obj = __commonJS({
    "node_modules/is-plain-obj/index.js"(exports, module) {
      "use strict";
      module.exports = (value) => {
        if (Object.prototype.toString.call(value) !== "[object Object]") {
          return false;
        }
        const prototype = Object.getPrototypeOf(value);
        return prototype === null || prototype === Object.prototype;
      };
    }
  });

  // node_modules/merge-options/index.js
  var require_merge_options = __commonJS({
    "node_modules/merge-options/index.js"(exports, module) {
      "use strict";
      var isOptionObject = require_is_plain_obj();
      var { hasOwnProperty: hasOwnProperty2 } = Object.prototype;
      var { propertyIsEnumerable } = Object;
      var defineProperty = (object, name, value) => Object.defineProperty(object, name, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      });
      var globalThis2 = exports;
      var defaultMergeOptions = {
        concatArrays: false,
        ignoreUndefined: false
      };
      var getEnumerableOwnPropertyKeys = (value) => {
        const keys = [];
        for (const key in value) {
          if (hasOwnProperty2.call(value, key)) {
            keys.push(key);
          }
        }
        if (Object.getOwnPropertySymbols) {
          const symbols = Object.getOwnPropertySymbols(value);
          for (const symbol of symbols) {
            if (propertyIsEnumerable.call(value, symbol)) {
              keys.push(symbol);
            }
          }
        }
        return keys;
      };
      function clone(value) {
        if (Array.isArray(value)) {
          return cloneArray(value);
        }
        if (isOptionObject(value)) {
          return cloneOptionObject(value);
        }
        return value;
      }
      function cloneArray(array) {
        const result = array.slice(0, 0);
        getEnumerableOwnPropertyKeys(array).forEach((key) => {
          defineProperty(result, key, clone(array[key]));
        });
        return result;
      }
      function cloneOptionObject(object) {
        const result = Object.getPrototypeOf(object) === null ? /* @__PURE__ */ Object.create(null) : {};
        getEnumerableOwnPropertyKeys(object).forEach((key) => {
          defineProperty(result, key, clone(object[key]));
        });
        return result;
      }
      var mergeKeys = (merged, source, keys, config) => {
        keys.forEach((key) => {
          if (typeof source[key] === "undefined" && config.ignoreUndefined) {
            return;
          }
          if (key in merged && merged[key] !== Object.getPrototypeOf(merged)) {
            defineProperty(merged, key, merge2(merged[key], source[key], config));
          } else {
            defineProperty(merged, key, clone(source[key]));
          }
        });
        return merged;
      };
      var concatArrays = (merged, source, config) => {
        let result = merged.slice(0, 0);
        let resultIndex = 0;
        [merged, source].forEach((array) => {
          const indices = [];
          for (let k = 0; k < array.length; k++) {
            if (!hasOwnProperty2.call(array, k)) {
              continue;
            }
            indices.push(String(k));
            if (array === merged) {
              defineProperty(result, resultIndex++, array[k]);
            } else {
              defineProperty(result, resultIndex++, clone(array[k]));
            }
          }
          result = mergeKeys(result, array, getEnumerableOwnPropertyKeys(array).filter((key) => !indices.includes(key)), config);
        });
        return result;
      };
      function merge2(merged, source, config) {
        if (config.concatArrays && Array.isArray(merged) && Array.isArray(source)) {
          return concatArrays(merged, source, config);
        }
        if (!isOptionObject(source) || !isOptionObject(merged)) {
          return clone(source);
        }
        return mergeKeys(merged, source, getEnumerableOwnPropertyKeys(source), config);
      }
      module.exports = function(...options) {
        const config = merge2(clone(defaultMergeOptions), this !== globalThis2 && this || {}, defaultMergeOptions);
        let merged = { _: {} };
        for (const option of options) {
          if (option === void 0) {
            continue;
          }
          if (!isOptionObject(option)) {
            throw new TypeError("`" + option + "` is not an Option Object");
          }
          merged = merge2(merged, { _: option }, config);
        }
        return merged._;
      };
    }
  });

  // node_modules/react/cjs/react-jsx-runtime.production.js
  var require_react_jsx_runtime_production = __commonJS({
    "node_modules/react/cjs/react-jsx-runtime.production.js"(exports) {
      "use strict";
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element");
      var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
      function jsxProd(type, config, maybeKey) {
        var key = null;
        void 0 !== maybeKey && (key = "" + maybeKey);
        void 0 !== config.key && (key = "" + config.key);
        if ("key" in config) {
          maybeKey = {};
          for (var propName in config)
            "key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        config = maybeKey.ref;
        return {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          ref: void 0 !== config ? config : null,
          props: maybeKey
        };
      }
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.jsx = jsxProd;
      exports.jsxs = jsxProd;
    }
  });

  // node_modules/react/jsx-runtime.js
  var require_jsx_runtime = __commonJS({
    "node_modules/react/jsx-runtime.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_react_jsx_runtime_production();
      } else {
        module.exports = null;
      }
    }
  });

  // ../test_reports/artifacts_iter49/notes-dialog-harness.tsx
  var import_react12 = __toESM(require_react());
  var import_client = __toESM(require_client());

  // node_modules/react-native-web/dist/modules/AccessibilityUtil/isDisabled.js
  var isDisabled = (props) => props.disabled || Array.isArray(props.accessibilityStates) && props.accessibilityStates.indexOf("disabled") > -1;
  var isDisabled_default = isDisabled;

  // node_modules/react-native-web/dist/modules/AccessibilityUtil/propsToAriaRole.js
  var accessibilityRoleToWebRole = {
    adjustable: "slider",
    button: "button",
    header: "heading",
    image: "img",
    imagebutton: null,
    keyboardkey: null,
    label: null,
    link: "link",
    none: "presentation",
    search: "search",
    summary: "region",
    text: null
  };
  var propsToAriaRole = (_ref) => {
    var accessibilityRole = _ref.accessibilityRole, role = _ref.role;
    var _role = role || accessibilityRole;
    if (_role) {
      var inferredRole = accessibilityRoleToWebRole[_role];
      if (inferredRole !== null) {
        return inferredRole || _role;
      }
    }
  };
  var propsToAriaRole_default = propsToAriaRole;

  // node_modules/react-native-web/dist/modules/AccessibilityUtil/propsToAccessibilityComponent.js
  var roleComponents = {
    article: "article",
    banner: "header",
    blockquote: "blockquote",
    button: "button",
    code: "code",
    complementary: "aside",
    contentinfo: "footer",
    deletion: "del",
    emphasis: "em",
    figure: "figure",
    insertion: "ins",
    form: "form",
    list: "ul",
    listitem: "li",
    main: "main",
    navigation: "nav",
    paragraph: "p",
    region: "section",
    strong: "strong"
  };
  var emptyObject = {};
  var propsToAccessibilityComponent = function propsToAccessibilityComponent2(props) {
    if (props === void 0) {
      props = emptyObject;
    }
    var roleProp = props.role || props.accessibilityRole;
    if (roleProp === "label") {
      return "label";
    }
    var role = propsToAriaRole_default(props);
    if (role) {
      if (role === "heading") {
        var level = props.accessibilityLevel || props["aria-level"];
        if (level != null) {
          return "h" + level;
        }
        return "h1";
      }
      return roleComponents[role];
    }
  };
  var propsToAccessibilityComponent_default = propsToAccessibilityComponent;

  // node_modules/react-native-web/dist/modules/AccessibilityUtil/index.js
  var AccessibilityUtil = {
    isDisabled: isDisabled_default,
    propsToAccessibilityComponent: propsToAccessibilityComponent_default,
    propsToAriaRole: propsToAriaRole_default
  };
  var AccessibilityUtil_default = AccessibilityUtil;

  // node_modules/react-native-web/node_modules/@babel/runtime/helpers/esm/typeof.js
  function _typeof(o) {
    "@babel/helpers - typeof";
    return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
      return typeof o2;
    } : function(o2) {
      return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
    }, _typeof(o);
  }

  // node_modules/react-native-web/node_modules/@babel/runtime/helpers/esm/toPrimitive.js
  function toPrimitive(t, r) {
    if ("object" != _typeof(t) || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != _typeof(i)) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }

  // node_modules/react-native-web/node_modules/@babel/runtime/helpers/esm/toPropertyKey.js
  function toPropertyKey(t) {
    var i = toPrimitive(t, "string");
    return "symbol" == _typeof(i) ? i : i + "";
  }

  // node_modules/react-native-web/node_modules/@babel/runtime/helpers/esm/defineProperty.js
  function _defineProperty(e, r, t) {
    return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
      value: t,
      enumerable: true,
      configurable: true,
      writable: true
    }) : e[r] = t, e;
  }

  // node_modules/react-native-web/node_modules/@babel/runtime/helpers/esm/objectSpread2.js
  function ownKeys(e, r) {
    var t = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e);
      r && (o = o.filter(function(r2) {
        return Object.getOwnPropertyDescriptor(e, r2).enumerable;
      })), t.push.apply(t, o);
    }
    return t;
  }
  function _objectSpread2(e) {
    for (var r = 1; r < arguments.length; r++) {
      var t = null != arguments[r] ? arguments[r] : {};
      r % 2 ? ownKeys(Object(t), true).forEach(function(r2) {
        _defineProperty(e, r2, t[r2]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r2) {
        Object.defineProperty(e, r2, Object.getOwnPropertyDescriptor(t, r2));
      });
    }
    return e;
  }

  // node_modules/react-native-web/node_modules/@babel/runtime/helpers/esm/objectWithoutPropertiesLoose.js
  function _objectWithoutPropertiesLoose(r, e) {
    if (null == r) return {};
    var t = {};
    for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
      if (-1 !== e.indexOf(n)) continue;
      t[n] = r[n];
    }
    return t;
  }

  // node_modules/react-native-web/dist/exports/StyleSheet/compiler/unitlessNumbers.js
  var unitlessNumbers = {
    animationIterationCount: true,
    aspectRatio: true,
    borderImageOutset: true,
    borderImageSlice: true,
    borderImageWidth: true,
    boxFlex: true,
    boxFlexGroup: true,
    boxOrdinalGroup: true,
    columnCount: true,
    flex: true,
    flexGrow: true,
    flexOrder: true,
    flexPositive: true,
    flexShrink: true,
    flexNegative: true,
    fontWeight: true,
    gridRow: true,
    gridRowEnd: true,
    gridRowGap: true,
    gridRowStart: true,
    gridColumn: true,
    gridColumnEnd: true,
    gridColumnGap: true,
    gridColumnStart: true,
    lineClamp: true,
    opacity: true,
    order: true,
    orphans: true,
    tabSize: true,
    widows: true,
    zIndex: true,
    zoom: true,
    // SVG-related
    fillOpacity: true,
    floodOpacity: true,
    stopOpacity: true,
    strokeDasharray: true,
    strokeDashoffset: true,
    strokeMiterlimit: true,
    strokeOpacity: true,
    strokeWidth: true,
    // transform types
    scale: true,
    scaleX: true,
    scaleY: true,
    scaleZ: true,
    // RN properties
    shadowOpacity: true
  };
  var prefixes = ["ms", "Moz", "O", "Webkit"];
  var prefixKey = (prefix, key) => {
    return prefix + key.charAt(0).toUpperCase() + key.substring(1);
  };
  Object.keys(unitlessNumbers).forEach((prop) => {
    prefixes.forEach((prefix) => {
      unitlessNumbers[prefixKey(prefix, prop)] = unitlessNumbers[prop];
    });
  });
  var unitlessNumbers_default = unitlessNumbers;

  // node_modules/react-native-web/dist/modules/isWebColor/index.js
  var isWebColor = (color) => color === "currentcolor" || color === "currentColor" || color === "inherit" || color.indexOf("var(") === 0;
  var isWebColor_default = isWebColor;

  // node_modules/react-native-web/dist/exports/processColor/index.js
  var import_normalize_colors = __toESM(require_normalize_colors());
  var processColor = (color) => {
    if (color === void 0 || color === null) {
      return color;
    }
    var int32Color = (0, import_normalize_colors.default)(color);
    if (int32Color === void 0 || int32Color === null) {
      return void 0;
    }
    int32Color = (int32Color << 24 | int32Color >>> 8) >>> 0;
    return int32Color;
  };
  var processColor_default = processColor;

  // node_modules/react-native-web/dist/exports/StyleSheet/compiler/normalizeColor.js
  var normalizeColor2 = function normalizeColor3(color, opacity) {
    if (opacity === void 0) {
      opacity = 1;
    }
    if (color == null) return;
    if (typeof color === "string" && isWebColor_default(color)) {
      return color;
    }
    var colorInt = processColor_default(color);
    if (colorInt != null) {
      var r = colorInt >> 16 & 255;
      var g = colorInt >> 8 & 255;
      var b = colorInt & 255;
      var a = (colorInt >> 24 & 255) / 255;
      var alpha = (a * opacity).toFixed(2);
      return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
    }
  };
  var normalizeColor_default = normalizeColor2;

  // node_modules/react-native-web/dist/exports/StyleSheet/compiler/normalizeValueWithProperty.js
  var colorProps = {
    backgroundColor: true,
    borderColor: true,
    borderTopColor: true,
    borderRightColor: true,
    borderBottomColor: true,
    borderLeftColor: true,
    color: true,
    shadowColor: true,
    textDecorationColor: true,
    textShadowColor: true
  };
  function normalizeValueWithProperty(value, property) {
    var returnValue = value;
    if ((property == null || !unitlessNumbers_default[property]) && typeof value === "number") {
      returnValue = value + "px";
    } else if (property != null && colorProps[property]) {
      returnValue = normalizeColor_default(value);
    }
    return returnValue;
  }

  // node_modules/react-native-web/dist/modules/canUseDom/index.js
  var canUseDOM = !!(typeof window !== "undefined" && window.document && window.document.createElement);
  var canUseDom_default = canUseDOM;

  // node_modules/react-native-web/dist/exports/StyleSheet/compiler/createReactDOMStyle.js
  var emptyObject2 = {};
  var supportsCSS3TextDecoration = !canUseDom_default || window.CSS != null && window.CSS.supports != null && (window.CSS.supports("text-decoration-line", "none") || window.CSS.supports("-webkit-text-decoration-line", "none"));
  var MONOSPACE_FONT_STACK = "monospace,monospace";
  var SYSTEM_FONT_STACK = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  var STYLE_SHORT_FORM_EXPANSIONS = {
    borderColor: ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"],
    borderBlockColor: ["borderTopColor", "borderBottomColor"],
    borderInlineColor: ["borderRightColor", "borderLeftColor"],
    borderRadius: ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"],
    borderStyle: ["borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle"],
    borderBlockStyle: ["borderTopStyle", "borderBottomStyle"],
    borderInlineStyle: ["borderRightStyle", "borderLeftStyle"],
    borderWidth: ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"],
    borderBlockWidth: ["borderTopWidth", "borderBottomWidth"],
    borderInlineWidth: ["borderRightWidth", "borderLeftWidth"],
    insetBlock: ["top", "bottom"],
    insetInline: ["left", "right"],
    marginBlock: ["marginTop", "marginBottom"],
    marginInline: ["marginRight", "marginLeft"],
    paddingBlock: ["paddingTop", "paddingBottom"],
    paddingInline: ["paddingRight", "paddingLeft"],
    overflow: ["overflowX", "overflowY"],
    overscrollBehavior: ["overscrollBehaviorX", "overscrollBehaviorY"],
    borderBlockStartColor: ["borderTopColor"],
    borderBlockStartStyle: ["borderTopStyle"],
    borderBlockStartWidth: ["borderTopWidth"],
    borderBlockEndColor: ["borderBottomColor"],
    borderBlockEndStyle: ["borderBottomStyle"],
    borderBlockEndWidth: ["borderBottomWidth"],
    //borderInlineStartColor: ['borderLeftColor'],
    //borderInlineStartStyle: ['borderLeftStyle'],
    //borderInlineStartWidth: ['borderLeftWidth'],
    //borderInlineEndColor: ['borderRightColor'],
    //borderInlineEndStyle: ['borderRightStyle'],
    //borderInlineEndWidth: ['borderRightWidth'],
    borderEndStartRadius: ["borderBottomLeftRadius"],
    borderEndEndRadius: ["borderBottomRightRadius"],
    borderStartStartRadius: ["borderTopLeftRadius"],
    borderStartEndRadius: ["borderTopRightRadius"],
    insetBlockEnd: ["bottom"],
    insetBlockStart: ["top"],
    //insetInlineEnd: ['right'],
    //insetInlineStart: ['left'],
    marginBlockStart: ["marginTop"],
    marginBlockEnd: ["marginBottom"],
    //marginInlineStart: ['marginLeft'],
    //marginInlineEnd: ['marginRight'],
    paddingBlockStart: ["paddingTop"],
    paddingBlockEnd: ["paddingBottom"]
    //paddingInlineStart: ['marginLeft'],
    //paddingInlineEnd: ['marginRight'],
  };
  var createReactDOMStyle = (style, isInline) => {
    if (!style) {
      return emptyObject2;
    }
    var resolvedStyle = {};
    var _loop = function _loop2() {
      var value = style[prop];
      if (
        // Ignore everything with a null value
        value == null
      ) {
        return "continue";
      }
      if (prop === "backgroundClip") {
        if (value === "text") {
          resolvedStyle.backgroundClip = value;
          resolvedStyle.WebkitBackgroundClip = value;
        }
      } else if (prop === "flex") {
        if (value === -1) {
          resolvedStyle.flexGrow = 0;
          resolvedStyle.flexShrink = 1;
          resolvedStyle.flexBasis = "auto";
        } else {
          resolvedStyle.flex = value;
        }
      } else if (prop === "font") {
        resolvedStyle[prop] = value.replace("System", SYSTEM_FONT_STACK);
      } else if (prop === "fontFamily") {
        if (value.indexOf("System") > -1) {
          var stack = value.split(/,\s*/);
          stack[stack.indexOf("System")] = SYSTEM_FONT_STACK;
          resolvedStyle[prop] = stack.join(",");
        } else if (value === "monospace") {
          resolvedStyle[prop] = MONOSPACE_FONT_STACK;
        } else {
          resolvedStyle[prop] = value;
        }
      } else if (prop === "textDecorationLine") {
        if (!supportsCSS3TextDecoration) {
          resolvedStyle.textDecoration = value;
        } else {
          resolvedStyle.textDecorationLine = value;
        }
      } else if (prop === "writingDirection") {
        resolvedStyle.direction = value;
      } else {
        var _value = normalizeValueWithProperty(style[prop], prop);
        var longFormProperties = STYLE_SHORT_FORM_EXPANSIONS[prop];
        if (isInline && prop === "inset") {
          if (style.insetInline == null) {
            resolvedStyle.left = _value;
            resolvedStyle.right = _value;
          }
          if (style.insetBlock == null) {
            resolvedStyle.top = _value;
            resolvedStyle.bottom = _value;
          }
        } else if (isInline && prop === "margin") {
          if (style.marginInline == null) {
            resolvedStyle.marginLeft = _value;
            resolvedStyle.marginRight = _value;
          }
          if (style.marginBlock == null) {
            resolvedStyle.marginTop = _value;
            resolvedStyle.marginBottom = _value;
          }
        } else if (isInline && prop === "padding") {
          if (style.paddingInline == null) {
            resolvedStyle.paddingLeft = _value;
            resolvedStyle.paddingRight = _value;
          }
          if (style.paddingBlock == null) {
            resolvedStyle.paddingTop = _value;
            resolvedStyle.paddingBottom = _value;
          }
        } else if (longFormProperties) {
          longFormProperties.forEach((longForm, i) => {
            if (style[longForm] == null) {
              resolvedStyle[longForm] = _value;
            }
          });
        } else {
          resolvedStyle[prop] = _value;
        }
      }
    };
    for (var prop in style) {
      var _ret = _loop();
      if (_ret === "continue") continue;
    }
    return resolvedStyle;
  };
  var createReactDOMStyle_default = createReactDOMStyle;

  // node_modules/react-native-web/dist/exports/StyleSheet/compiler/hash.js
  function murmurhash2_32_gc(str, seed) {
    var l = str.length, h = seed ^ l, i = 0, k;
    while (l >= 4) {
      k = str.charCodeAt(i) & 255 | (str.charCodeAt(++i) & 255) << 8 | (str.charCodeAt(++i) & 255) << 16 | (str.charCodeAt(++i) & 255) << 24;
      k = (k & 65535) * 1540483477 + (((k >>> 16) * 1540483477 & 65535) << 16);
      k ^= k >>> 24;
      k = (k & 65535) * 1540483477 + (((k >>> 16) * 1540483477 & 65535) << 16);
      h = (h & 65535) * 1540483477 + (((h >>> 16) * 1540483477 & 65535) << 16) ^ k;
      l -= 4;
      ++i;
    }
    switch (l) {
      case 3:
        h ^= (str.charCodeAt(i + 2) & 255) << 16;
      case 2:
        h ^= (str.charCodeAt(i + 1) & 255) << 8;
      case 1:
        h ^= str.charCodeAt(i) & 255;
        h = (h & 65535) * 1540483477 + (((h >>> 16) * 1540483477 & 65535) << 16);
    }
    h ^= h >>> 13;
    h = (h & 65535) * 1540483477 + (((h >>> 16) * 1540483477 & 65535) << 16);
    h ^= h >>> 15;
    return h >>> 0;
  }
  var hash = (str) => murmurhash2_32_gc(str, 1).toString(36);
  var hash_default = hash;

  // node_modules/react-native-web/dist/exports/StyleSheet/compiler/hyphenateStyleName.js
  var uppercasePattern = /[A-Z]/g;
  var msPattern = /^ms-/;
  var cache = {};
  function toHyphenLower(match) {
    return "-" + match.toLowerCase();
  }
  function hyphenateStyleName(name) {
    if (name in cache) {
      return cache[name];
    }
    var hName = name.replace(uppercasePattern, toHyphenLower);
    return cache[name] = msPattern.test(hName) ? "-" + hName : hName;
  }
  var hyphenateStyleName_default = hyphenateStyleName;

  // node_modules/react-native-web/dist/modules/prefixStyles/index.js
  var import_createPrefixer = __toESM(require_createPrefixer());

  // node_modules/react-native-web/dist/modules/prefixStyles/static.js
  var import_crossFade = __toESM(require_crossFade());
  var import_imageSet = __toESM(require_imageSet());
  var import_logical = __toESM(require_logical());
  var import_position = __toESM(require_position());
  var import_sizing = __toESM(require_sizing());
  var import_transition = __toESM(require_transition());
  var w = ["Webkit"];
  var m = ["Moz"];
  var wm = ["Webkit", "Moz"];
  var wms = ["Webkit", "ms"];
  var wmms = ["Webkit", "Moz", "ms"];
  var static_default = {
    plugins: [import_crossFade.default, import_imageSet.default, import_logical.default, import_position.default, import_sizing.default, import_transition.default],
    prefixMap: {
      appearance: wmms,
      userSelect: wm,
      textEmphasisPosition: wms,
      textEmphasis: wms,
      textEmphasisStyle: wms,
      textEmphasisColor: wms,
      boxDecorationBreak: wms,
      clipPath: w,
      maskImage: wms,
      maskMode: wms,
      maskRepeat: wms,
      maskPosition: wms,
      maskClip: wms,
      maskOrigin: wms,
      maskSize: wms,
      maskComposite: wms,
      mask: wms,
      maskBorderSource: wms,
      maskBorderMode: wms,
      maskBorderSlice: wms,
      maskBorderWidth: wms,
      maskBorderOutset: wms,
      maskBorderRepeat: wms,
      maskBorder: wms,
      maskType: wms,
      textDecorationStyle: w,
      textDecorationSkip: w,
      textDecorationLine: w,
      textDecorationColor: w,
      filter: w,
      breakAfter: w,
      breakBefore: w,
      breakInside: w,
      columnCount: w,
      columnFill: w,
      columnGap: w,
      columnRule: w,
      columnRuleColor: w,
      columnRuleStyle: w,
      columnRuleWidth: w,
      columns: w,
      columnSpan: w,
      columnWidth: w,
      backdropFilter: w,
      hyphens: w,
      flowInto: w,
      flowFrom: w,
      regionFragment: w,
      textOrientation: w,
      tabSize: m,
      fontKerning: w,
      textSizeAdjust: w
    }
  };

  // node_modules/react-native-web/dist/modules/prefixStyles/index.js
  var prefixAll = (0, import_createPrefixer.default)(static_default);
  var prefixStyles_default = prefixAll;

  // node_modules/react-native-web/dist/exports/StyleSheet/compiler/index.js
  var _excluded = ["animationKeyframes"];
  var cache2 = /* @__PURE__ */ new Map();
  var emptyObject3 = {};
  var classicGroup = 1;
  var atomicGroup = 3;
  var customGroup = {
    borderColor: 2,
    borderRadius: 2,
    borderStyle: 2,
    borderWidth: 2,
    display: 2,
    flex: 2,
    inset: 2,
    margin: 2,
    overflow: 2,
    overscrollBehavior: 2,
    padding: 2,
    insetBlock: 2.1,
    insetInline: 2.1,
    marginInline: 2.1,
    marginBlock: 2.1,
    paddingInline: 2.1,
    paddingBlock: 2.1,
    borderBlockStartColor: 2.2,
    borderBlockStartStyle: 2.2,
    borderBlockStartWidth: 2.2,
    borderBlockEndColor: 2.2,
    borderBlockEndStyle: 2.2,
    borderBlockEndWidth: 2.2,
    borderInlineStartColor: 2.2,
    borderInlineStartStyle: 2.2,
    borderInlineStartWidth: 2.2,
    borderInlineEndColor: 2.2,
    borderInlineEndStyle: 2.2,
    borderInlineEndWidth: 2.2,
    borderEndStartRadius: 2.2,
    borderEndEndRadius: 2.2,
    borderStartStartRadius: 2.2,
    borderStartEndRadius: 2.2,
    insetBlockEnd: 2.2,
    insetBlockStart: 2.2,
    insetInlineEnd: 2.2,
    insetInlineStart: 2.2,
    marginBlockStart: 2.2,
    marginBlockEnd: 2.2,
    marginInlineStart: 2.2,
    marginInlineEnd: 2.2,
    paddingBlockStart: 2.2,
    paddingBlockEnd: 2.2,
    paddingInlineStart: 2.2,
    paddingInlineEnd: 2.2
  };
  var borderTopLeftRadius = "borderTopLeftRadius";
  var borderTopRightRadius = "borderTopRightRadius";
  var borderBottomLeftRadius = "borderBottomLeftRadius";
  var borderBottomRightRadius = "borderBottomRightRadius";
  var borderLeftColor = "borderLeftColor";
  var borderLeftStyle = "borderLeftStyle";
  var borderLeftWidth = "borderLeftWidth";
  var borderRightColor = "borderRightColor";
  var borderRightStyle = "borderRightStyle";
  var borderRightWidth = "borderRightWidth";
  var right = "right";
  var marginLeft = "marginLeft";
  var marginRight = "marginRight";
  var paddingLeft = "paddingLeft";
  var paddingRight = "paddingRight";
  var left = "left";
  var PROPERTIES_FLIP = {
    [borderTopLeftRadius]: borderTopRightRadius,
    [borderTopRightRadius]: borderTopLeftRadius,
    [borderBottomLeftRadius]: borderBottomRightRadius,
    [borderBottomRightRadius]: borderBottomLeftRadius,
    [borderLeftColor]: borderRightColor,
    [borderLeftStyle]: borderRightStyle,
    [borderLeftWidth]: borderRightWidth,
    [borderRightColor]: borderLeftColor,
    [borderRightStyle]: borderLeftStyle,
    [borderRightWidth]: borderLeftWidth,
    [left]: right,
    [marginLeft]: marginRight,
    [marginRight]: marginLeft,
    [paddingLeft]: paddingRight,
    [paddingRight]: paddingLeft,
    [right]: left
  };
  var PROPERTIES_I18N = {
    borderStartStartRadius: borderTopLeftRadius,
    borderStartEndRadius: borderTopRightRadius,
    borderEndStartRadius: borderBottomLeftRadius,
    borderEndEndRadius: borderBottomRightRadius,
    borderInlineStartColor: borderLeftColor,
    borderInlineStartStyle: borderLeftStyle,
    borderInlineStartWidth: borderLeftWidth,
    borderInlineEndColor: borderRightColor,
    borderInlineEndStyle: borderRightStyle,
    borderInlineEndWidth: borderRightWidth,
    insetInlineEnd: right,
    insetInlineStart: left,
    marginInlineStart: marginLeft,
    marginInlineEnd: marginRight,
    paddingInlineStart: paddingLeft,
    paddingInlineEnd: paddingRight
  };
  var PROPERTIES_VALUE = ["clear", "float", "textAlign"];
  function atomic(style) {
    var compiledStyle = {
      $$css: true
    };
    var compiledRules = [];
    function atomicCompile(srcProp, prop, value) {
      var valueString = stringifyValueWithProperty(value, prop);
      var cacheKey = prop + valueString;
      var cachedResult = cache2.get(cacheKey);
      var identifier;
      if (cachedResult != null) {
        identifier = cachedResult[0];
        compiledRules.push(cachedResult[1]);
      } else {
        var v = srcProp !== prop ? cacheKey : valueString;
        identifier = createIdentifier("r", srcProp, v);
        var order = customGroup[srcProp] || atomicGroup;
        var rules = createAtomicRules(identifier, prop, value);
        var orderedRules = [rules, order];
        compiledRules.push(orderedRules);
        cache2.set(cacheKey, [identifier, orderedRules]);
      }
      return identifier;
    }
    Object.keys(style).sort().forEach((srcProp) => {
      var value = style[srcProp];
      if (value != null) {
        var localizeableValue;
        if (PROPERTIES_VALUE.indexOf(srcProp) > -1) {
          var _left = atomicCompile(srcProp, srcProp, "left");
          var _right = atomicCompile(srcProp, srcProp, "right");
          if (value === "start") {
            localizeableValue = [_left, _right];
          } else if (value === "end") {
            localizeableValue = [_right, _left];
          }
        }
        var propPolyfill = PROPERTIES_I18N[srcProp];
        if (propPolyfill != null) {
          var ltr = atomicCompile(srcProp, propPolyfill, value);
          var rtl = atomicCompile(srcProp, PROPERTIES_FLIP[propPolyfill], value);
          localizeableValue = [ltr, rtl];
        }
        if (srcProp === "transitionProperty") {
          var values = Array.isArray(value) ? value : [value];
          var polyfillIndices = [];
          for (var i = 0; i < values.length; i++) {
            var val = values[i];
            if (typeof val === "string" && PROPERTIES_I18N[val] != null) {
              polyfillIndices.push(i);
            }
          }
          if (polyfillIndices.length > 0) {
            var ltrPolyfillValues = [...values];
            var rtlPolyfillValues = [...values];
            polyfillIndices.forEach((i2) => {
              var ltrVal = ltrPolyfillValues[i2];
              if (typeof ltrVal === "string") {
                var ltrPolyfill = PROPERTIES_I18N[ltrVal];
                var rtlPolyfill = PROPERTIES_FLIP[ltrPolyfill];
                ltrPolyfillValues[i2] = ltrPolyfill;
                rtlPolyfillValues[i2] = rtlPolyfill;
                var _ltr = atomicCompile(srcProp, srcProp, ltrPolyfillValues);
                var _rtl = atomicCompile(srcProp, srcProp, rtlPolyfillValues);
                localizeableValue = [_ltr, _rtl];
              }
            });
          }
        }
        if (localizeableValue == null) {
          localizeableValue = atomicCompile(srcProp, srcProp, value);
        } else {
          compiledStyle["$$css$localize"] = true;
        }
        compiledStyle[srcProp] = localizeableValue;
      }
    });
    return [compiledStyle, compiledRules];
  }
  function classic(style, name) {
    var compiledStyle = {
      $$css: true
    };
    var compiledRules = [];
    var animationKeyframes = style.animationKeyframes, rest = _objectWithoutPropertiesLoose(style, _excluded);
    var identifier = createIdentifier("css", name, JSON.stringify(style));
    var selector = "." + identifier;
    var animationName;
    if (animationKeyframes != null) {
      var _processKeyframesValu = processKeyframesValue(animationKeyframes), animationNames = _processKeyframesValu[0], keyframesRules = _processKeyframesValu[1];
      animationName = animationNames.join(",");
      compiledRules.push(...keyframesRules);
    }
    var block = createDeclarationBlock(_objectSpread2(_objectSpread2({}, rest), {}, {
      animationName
    }));
    compiledRules.push("" + selector + block);
    compiledStyle[identifier] = identifier;
    return [compiledStyle, [[compiledRules, classicGroup]]];
  }
  function inline(originalStyle, isRTL) {
    var style = originalStyle || emptyObject3;
    var frozenProps = {};
    var nextStyle = {};
    var _loop = function _loop2() {
      var originalValue = style[originalProp];
      var prop = originalProp;
      var value = originalValue;
      if (!Object.prototype.hasOwnProperty.call(style, originalProp) || originalValue == null) {
        return "continue";
      }
      if (PROPERTIES_VALUE.indexOf(originalProp) > -1) {
        if (originalValue === "start") {
          value = isRTL ? "right" : "left";
        } else if (originalValue === "end") {
          value = isRTL ? "left" : "right";
        }
      }
      var propPolyfill = PROPERTIES_I18N[originalProp];
      if (propPolyfill != null) {
        prop = isRTL ? PROPERTIES_FLIP[propPolyfill] : propPolyfill;
      }
      if (originalProp === "transitionProperty") {
        var originalValues = Array.isArray(originalValue) ? originalValue : [originalValue];
        originalValues.forEach((val, i) => {
          if (typeof val === "string") {
            var valuePolyfill = PROPERTIES_I18N[val];
            if (valuePolyfill != null) {
              originalValues[i] = isRTL ? PROPERTIES_FLIP[valuePolyfill] : valuePolyfill;
              value = originalValues.join(" ");
            }
          }
        });
      }
      if (!frozenProps[prop]) {
        nextStyle[prop] = value;
      }
      if (prop === originalProp) {
        frozenProps[prop] = true;
      }
    };
    for (var originalProp in style) {
      var _ret = _loop();
      if (_ret === "continue") continue;
    }
    return createReactDOMStyle_default(nextStyle, true);
  }
  function stringifyValueWithProperty(value, property) {
    var normalizedValue = normalizeValueWithProperty(value, property);
    return typeof normalizedValue !== "string" ? JSON.stringify(normalizedValue || "") : normalizedValue;
  }
  function createAtomicRules(identifier, property, value) {
    var rules = [];
    var selector = "." + identifier;
    switch (property) {
      case "animationKeyframes": {
        var _processKeyframesValu2 = processKeyframesValue(value), animationNames = _processKeyframesValu2[0], keyframesRules = _processKeyframesValu2[1];
        var block = createDeclarationBlock({
          animationName: animationNames.join(",")
        });
        rules.push("" + selector + block, ...keyframesRules);
        break;
      }
      // Equivalent to using '::placeholder'
      case "placeholderTextColor": {
        var _block = createDeclarationBlock({
          color: value,
          opacity: 1
        });
        rules.push(selector + "::-webkit-input-placeholder" + _block, selector + "::-moz-placeholder" + _block, selector + ":-ms-input-placeholder" + _block, selector + "::placeholder" + _block);
        break;
      }
      // Polyfill for additional 'pointer-events' values
      // See d13f78622b233a0afc0c7a200c0a0792c8ca9e58
      // See https://reactnative.dev/docs/view#pointerevents
      case "pointerEvents": {
        var finalValue = value;
        if (value === "auto") {
          finalValue = "auto!important";
        } else if (value === "none") {
          finalValue = "none!important";
          var _block2 = createDeclarationBlock({
            pointerEvents: "none"
          });
          rules.push(selector + ">* " + _block2);
        } else if (value === "box-none") {
          finalValue = "none!important";
          var _block3 = createDeclarationBlock({
            pointerEvents: "auto"
          });
          rules.push(selector + ">* " + _block3);
        } else if (value === "box-only") {
          finalValue = "auto!important";
          var _block4 = createDeclarationBlock({
            pointerEvents: "none"
          });
          rules.push(selector + ">* " + _block4);
        }
        var _block5 = createDeclarationBlock({
          pointerEvents: finalValue
        });
        rules.push("" + selector + _block5);
        break;
      }
      // Polyfill for draft spec
      // https://drafts.csswg.org/css-scrollbars-1/
      case "scrollbarWidth": {
        if (value === "none") {
          rules.push(selector + "::-webkit-scrollbar{display:none}");
        }
        var _block6 = createDeclarationBlock({
          scrollbarWidth: value
        });
        rules.push("" + selector + _block6);
        break;
      }
      default: {
        var _block7 = createDeclarationBlock({
          [property]: value
        });
        rules.push("" + selector + _block7);
        break;
      }
    }
    return rules;
  }
  function createDeclarationBlock(style) {
    var domStyle = prefixStyles_default(createReactDOMStyle_default(style));
    var declarationsString = Object.keys(domStyle).map((property) => {
      var value = domStyle[property];
      var prop = hyphenateStyleName_default(property);
      if (Array.isArray(value)) {
        return value.map((v) => prop + ":" + v).join(";");
      } else {
        return prop + ":" + value;
      }
    }).sort().join(";");
    return "{" + declarationsString + ";}";
  }
  function createIdentifier(prefix, name, key) {
    var hashedString = hash_default(name + key);
    return false ? prefix + "-" + name + "-" + hashedString : prefix + "-" + hashedString;
  }
  function createKeyframes(keyframes) {
    var prefixes3 = ["-webkit-", ""];
    var identifier = createIdentifier("r", "animation", JSON.stringify(keyframes));
    var steps = "{" + Object.keys(keyframes).map((stepName) => {
      var rule = keyframes[stepName];
      var block = createDeclarationBlock(rule);
      return "" + stepName + block;
    }).join("") + "}";
    var rules = prefixes3.map((prefix) => {
      return "@" + prefix + "keyframes " + identifier + steps;
    });
    return [identifier, rules];
  }
  function processKeyframesValue(keyframesValue) {
    if (typeof keyframesValue === "number") {
      throw new Error("Invalid CSS keyframes type: " + typeof keyframesValue);
    }
    var animationNames = [];
    var rules = [];
    var value = Array.isArray(keyframesValue) ? keyframesValue : [keyframesValue];
    value.forEach((keyframes) => {
      if (typeof keyframes === "string") {
        animationNames.push(keyframes);
      } else {
        var _createKeyframes = createKeyframes(keyframes), identifier = _createKeyframes[0], keyframesRules = _createKeyframes[1];
        animationNames.push(identifier);
        rules.push(...keyframesRules);
      }
    });
    return [animationNames, rules];
  }

  // node_modules/react-native-web/dist/exports/StyleSheet/dom/createCSSStyleSheet.js
  function createCSSStyleSheet(id, rootNode, textContent) {
    if (canUseDom_default) {
      var root = rootNode != null ? rootNode : document;
      var element = root.getElementById(id);
      if (element == null) {
        element = document.createElement("style");
        element.setAttribute("id", id);
        if (typeof textContent === "string") {
          element.appendChild(document.createTextNode(textContent));
        }
        if (root instanceof ShadowRoot) {
          root.insertBefore(element, root.firstChild);
        } else {
          var head = root.head;
          if (head) {
            head.insertBefore(element, head.firstChild);
          }
        }
      }
      return element.sheet;
    } else {
      return null;
    }
  }

  // node_modules/react-native-web/dist/exports/StyleSheet/dom/createOrderedCSSStyleSheet.js
  var slice = Array.prototype.slice;
  function createOrderedCSSStyleSheet(sheet2) {
    var groups = {};
    var selectors = {};
    if (sheet2 != null) {
      var group;
      slice.call(sheet2.cssRules).forEach((cssRule, i) => {
        var cssText = cssRule.cssText;
        if (cssText.indexOf("stylesheet-group") > -1) {
          group = decodeGroupRule(cssRule);
          groups[group] = {
            start: i,
            rules: [cssText]
          };
        } else {
          var selectorText = getSelectorText(cssText);
          if (selectorText != null) {
            selectors[selectorText] = true;
            groups[group].rules.push(cssText);
          }
        }
      });
    }
    function sheetInsert(sheet3, group2, text) {
      var orderedGroups = getOrderedGroups(groups);
      var groupIndex = orderedGroups.indexOf(group2);
      var nextGroupIndex = groupIndex + 1;
      var nextGroup = orderedGroups[nextGroupIndex];
      var position2 = nextGroup != null && groups[nextGroup].start != null ? groups[nextGroup].start : sheet3.cssRules.length;
      var isInserted = insertRuleAt(sheet3, text, position2);
      if (isInserted) {
        if (groups[group2].start == null) {
          groups[group2].start = position2;
        }
        for (var i = nextGroupIndex; i < orderedGroups.length; i += 1) {
          var groupNumber = orderedGroups[i];
          var previousStart = groups[groupNumber].start || 0;
          groups[groupNumber].start = previousStart + 1;
        }
      }
      return isInserted;
    }
    var OrderedCSSStyleSheet = {
      /**
       * The textContent of the style sheet.
       */
      getTextContent() {
        return getOrderedGroups(groups).map((group2) => {
          var rules = groups[group2].rules;
          var marker = rules.shift();
          rules.sort();
          rules.unshift(marker);
          return rules.join("\n");
        }).join("\n");
      },
      /**
       * Insert a rule into the style sheet
       */
      insert(cssText, groupValue) {
        var group2 = Number(groupValue);
        if (groups[group2] == null) {
          var markerRule = encodeGroupRule(group2);
          groups[group2] = {
            start: null,
            rules: [markerRule]
          };
          if (sheet2 != null) {
            sheetInsert(sheet2, group2, markerRule);
          }
        }
        var selectorText = getSelectorText(cssText);
        if (selectorText != null && selectors[selectorText] == null) {
          selectors[selectorText] = true;
          groups[group2].rules.push(cssText);
          if (sheet2 != null) {
            var isInserted = sheetInsert(sheet2, group2, cssText);
            if (!isInserted) {
              groups[group2].rules.pop();
            }
          }
        }
      }
    };
    return OrderedCSSStyleSheet;
  }
  function encodeGroupRule(group) {
    return '[stylesheet-group="' + group + '"]{}';
  }
  var groupPattern = /["']/g;
  function decodeGroupRule(cssRule) {
    return Number(cssRule.selectorText.split(groupPattern)[1]);
  }
  function getOrderedGroups(obj) {
    return Object.keys(obj).map(Number).sort((a, b) => a > b ? 1 : -1);
  }
  var selectorPattern = /\s*([,])\s*/g;
  function getSelectorText(cssText) {
    var selector = cssText.split("{")[0].trim();
    return selector !== "" ? selector.replace(selectorPattern, "$1") : null;
  }
  function insertRuleAt(root, cssText, position2) {
    try {
      root.insertRule(cssText, position2);
      return true;
    } catch (e) {
      return false;
    }
  }

  // node_modules/react-native-web/dist/exports/StyleSheet/dom/index.js
  var defaultId = "react-native-stylesheet";
  var roots = /* @__PURE__ */ new WeakMap();
  var sheets = [];
  var initialRules = [
    // minimal top-level reset
    "html{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:rgba(0,0,0,0);}",
    "body{margin:0;}",
    // minimal form pseudo-element reset
    "button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0;}",
    "input::-webkit-search-cancel-button,input::-webkit-search-decoration,input::-webkit-search-results-button,input::-webkit-search-results-decoration{display:none;}"
  ];
  function createSheet(root, id) {
    if (id === void 0) {
      id = defaultId;
    }
    var sheet2;
    if (canUseDom_default) {
      var rootNode = root != null ? root.getRootNode() : document;
      if (sheets.length === 0) {
        sheet2 = createOrderedCSSStyleSheet(createCSSStyleSheet(id));
        initialRules.forEach((rule) => {
          sheet2.insert(rule, 0);
        });
        roots.set(rootNode, sheets.length);
        sheets.push(sheet2);
      } else {
        var index = roots.get(rootNode);
        if (index == null) {
          var initialSheet = sheets[0];
          var textContent = initialSheet != null ? initialSheet.getTextContent() : "";
          sheet2 = createOrderedCSSStyleSheet(createCSSStyleSheet(id, rootNode, textContent));
          roots.set(rootNode, sheets.length);
          sheets.push(sheet2);
        } else {
          sheet2 = sheets[index];
        }
      }
    } else {
      if (sheets.length === 0) {
        sheet2 = createOrderedCSSStyleSheet(createCSSStyleSheet(id));
        initialRules.forEach((rule) => {
          sheet2.insert(rule, 0);
        });
        sheets.push(sheet2);
      } else {
        sheet2 = sheets[0];
      }
    }
    return {
      getTextContent() {
        return sheet2.getTextContent();
      },
      id,
      insert(cssText, groupValue) {
        sheets.forEach((s) => {
          s.insert(cssText, groupValue);
        });
      }
    };
  }

  // node_modules/react-native-web/dist/exports/StyleSheet/index.js
  var import_transform_localize_style = __toESM(require_transform_localize_style2());

  // node_modules/react-native-web/dist/modules/warnOnce/index.js
  function warnOnce(key, message) {
    if (false) {
      if (warnedKeys[key]) {
        return;
      }
      console.warn(message);
      warnedKeys[key] = true;
    }
  }

  // node_modules/react-native-web/dist/exports/StyleSheet/preprocess.js
  var emptyObject4 = {};
  var defaultOffset = {
    height: 0,
    width: 0
  };
  var createBoxShadowValue = (style) => {
    var shadowColor = style.shadowColor, shadowOffset = style.shadowOffset, shadowOpacity = style.shadowOpacity, shadowRadius = style.shadowRadius;
    var _ref = shadowOffset || defaultOffset, height = _ref.height, width = _ref.width;
    var offsetX = normalizeValueWithProperty(width);
    var offsetY = normalizeValueWithProperty(height);
    var blurRadius = normalizeValueWithProperty(shadowRadius || 0);
    var color = normalizeColor_default(shadowColor || "black", shadowOpacity);
    if (color != null && offsetX != null && offsetY != null && blurRadius != null) {
      return offsetX + " " + offsetY + " " + blurRadius + " " + color;
    }
  };
  var createTextShadowValue = (style) => {
    var textShadowColor = style.textShadowColor, textShadowOffset = style.textShadowOffset, textShadowRadius = style.textShadowRadius;
    var _ref2 = textShadowOffset || defaultOffset, height = _ref2.height, width = _ref2.width;
    var radius = textShadowRadius || 0;
    var offsetX = normalizeValueWithProperty(width);
    var offsetY = normalizeValueWithProperty(height);
    var blurRadius = normalizeValueWithProperty(radius);
    var color = normalizeValueWithProperty(textShadowColor, "textShadowColor");
    if (color && (height !== 0 || width !== 0 || radius !== 0) && offsetX != null && offsetY != null && blurRadius != null) {
      return offsetX + " " + offsetY + " " + blurRadius + " " + color;
    }
  };
  var mapBoxShadow = (boxShadow) => {
    if (typeof boxShadow === "string") {
      return boxShadow;
    }
    var offsetX = normalizeValueWithProperty(boxShadow.offsetX) || 0;
    var offsetY = normalizeValueWithProperty(boxShadow.offsetY) || 0;
    var blurRadius = normalizeValueWithProperty(boxShadow.blurRadius) || 0;
    var spreadDistance = normalizeValueWithProperty(boxShadow.spreadDistance) || 0;
    var color = normalizeColor_default(boxShadow.color) || "black";
    var position2 = boxShadow.inset ? "inset " : "";
    return "" + position2 + offsetX + " " + offsetY + " " + blurRadius + " " + spreadDistance + " " + color;
  };
  var createBoxShadowArrayValue = (value) => {
    return value.map(mapBoxShadow).join(", ");
  };
  var mapTransform = (transform) => {
    var type = Object.keys(transform)[0];
    var value = transform[type];
    if (type === "matrix" || type === "matrix3d") {
      return type + "(" + value.join(",") + ")";
    } else {
      var normalizedValue = normalizeValueWithProperty(value, type);
      return type + "(" + normalizedValue + ")";
    }
  };
  var createTransformValue = (value) => {
    return value.map(mapTransform).join(" ");
  };
  var createTransformOriginValue = (value) => {
    return value.map((v) => normalizeValueWithProperty(v)).join(" ");
  };
  var PROPERTIES_STANDARD = {
    borderBottomEndRadius: "borderEndEndRadius",
    borderBottomStartRadius: "borderEndStartRadius",
    borderTopEndRadius: "borderStartEndRadius",
    borderTopStartRadius: "borderStartStartRadius",
    borderEndColor: "borderInlineEndColor",
    borderEndStyle: "borderInlineEndStyle",
    borderEndWidth: "borderInlineEndWidth",
    borderStartColor: "borderInlineStartColor",
    borderStartStyle: "borderInlineStartStyle",
    borderStartWidth: "borderInlineStartWidth",
    end: "insetInlineEnd",
    marginEnd: "marginInlineEnd",
    marginHorizontal: "marginInline",
    marginStart: "marginInlineStart",
    marginVertical: "marginBlock",
    paddingEnd: "paddingInlineEnd",
    paddingHorizontal: "paddingInline",
    paddingStart: "paddingInlineStart",
    paddingVertical: "paddingBlock",
    start: "insetInlineStart"
  };
  var ignoredProps = {
    elevation: true,
    overlayColor: true,
    resizeMode: true,
    tintColor: true
  };
  var preprocess = function preprocess2(originalStyle, options) {
    if (options === void 0) {
      options = {};
    }
    var style = originalStyle || emptyObject4;
    var nextStyle = {};
    if (options.shadow === true, style.shadowColor != null || style.shadowOffset != null || style.shadowOpacity != null || style.shadowRadius != null) {
      warnOnce("shadowStyles", '"shadow*" style props are deprecated. Use "boxShadow".');
      var boxShadowValue = createBoxShadowValue(style);
      if (boxShadowValue != null) {
        nextStyle.boxShadow = boxShadowValue;
      }
    }
    if (options.textShadow === true, style.textShadowColor != null || style.textShadowOffset != null || style.textShadowRadius != null) {
      warnOnce("textShadowStyles", '"textShadow*" style props are deprecated. Use "textShadow".');
      var textShadowValue = createTextShadowValue(style);
      if (textShadowValue != null && nextStyle.textShadow == null) {
        var textShadow = style.textShadow;
        var value = textShadow ? textShadow + ", " + textShadowValue : textShadowValue;
        nextStyle.textShadow = value;
      }
    }
    for (var originalProp in style) {
      if (
        // Ignore some React Native styles
        ignoredProps[originalProp] != null || originalProp === "shadowColor" || originalProp === "shadowOffset" || originalProp === "shadowOpacity" || originalProp === "shadowRadius" || originalProp === "textShadowColor" || originalProp === "textShadowOffset" || originalProp === "textShadowRadius"
      ) {
        continue;
      }
      var originalValue = style[originalProp];
      var prop = PROPERTIES_STANDARD[originalProp] || originalProp;
      var _value = originalValue;
      if (!Object.prototype.hasOwnProperty.call(style, originalProp) || prop !== originalProp && style[prop] != null) {
        continue;
      }
      if (prop === "aspectRatio" && typeof _value === "number") {
        nextStyle[prop] = _value.toString();
      } else if (prop === "boxShadow") {
        if (Array.isArray(_value)) {
          _value = createBoxShadowArrayValue(_value);
        }
        var boxShadow = nextStyle.boxShadow;
        nextStyle.boxShadow = boxShadow ? _value + ", " + boxShadow : _value;
      } else if (prop === "fontVariant") {
        if (Array.isArray(_value) && _value.length > 0) {
          _value = _value.join(" ");
        }
        nextStyle[prop] = _value;
      } else if (prop === "textAlignVertical") {
        if (style.verticalAlign == null) {
          nextStyle.verticalAlign = _value === "center" ? "middle" : _value;
        }
      } else if (prop === "transform") {
        if (Array.isArray(_value)) {
          _value = createTransformValue(_value);
        }
        nextStyle.transform = _value;
      } else if (prop === "transformOrigin") {
        if (Array.isArray(_value)) {
          _value = createTransformOriginValue(_value);
        }
        nextStyle.transformOrigin = _value;
      } else {
        nextStyle[prop] = _value;
      }
    }
    return nextStyle;
  };

  // node_modules/react-native-web/dist/exports/StyleSheet/index.js
  var import_styleq = __toESM(require_styleq());
  var _excluded2 = ["writingDirection"];
  var staticStyleMap = /* @__PURE__ */ new WeakMap();
  var sheet = createSheet();
  var defaultPreprocessOptions = {
    shadow: true,
    textShadow: true
  };
  function customStyleq(styles16, options) {
    if (options === void 0) {
      options = {};
    }
    var _options = options, writingDirection = _options.writingDirection, preprocessOptions = _objectWithoutPropertiesLoose(_options, _excluded2);
    var isRTL = writingDirection === "rtl";
    return import_styleq.styleq.factory({
      transform(style) {
        var compiledStyle = staticStyleMap.get(style);
        if (compiledStyle != null) {
          return (0, import_transform_localize_style.localizeStyle)(compiledStyle, isRTL);
        }
        return preprocess(style, _objectSpread2(_objectSpread2({}, defaultPreprocessOptions), preprocessOptions));
      }
    })(styles16);
  }
  function insertRules(compiledOrderedRules) {
    compiledOrderedRules.forEach((_ref) => {
      var rules = _ref[0], order = _ref[1];
      if (sheet != null) {
        rules.forEach((rule) => {
          sheet.insert(rule, order);
        });
      }
    });
  }
  function compileAndInsertAtomic(style) {
    var _atomic = atomic(preprocess(style, defaultPreprocessOptions)), compiledStyle = _atomic[0], compiledOrderedRules = _atomic[1];
    insertRules(compiledOrderedRules);
    return compiledStyle;
  }
  function compileAndInsertReset(style, key) {
    var _classic = classic(style, key), compiledStyle = _classic[0], compiledOrderedRules = _classic[1];
    insertRules(compiledOrderedRules);
    return compiledStyle;
  }
  var absoluteFillObject = {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  };
  var absoluteFill = create({
    x: _objectSpread2({}, absoluteFillObject)
  }).x;
  function create(styles16) {
    Object.keys(styles16).forEach((key) => {
      var styleObj = styles16[key];
      if (styleObj != null && styleObj.$$css !== true) {
        var compiledStyles;
        if (key.indexOf("$raw") > -1) {
          compiledStyles = compileAndInsertReset(styleObj, key.split("$raw")[0]);
        } else {
          if (false) {
            validate(styleObj);
            styles16[key] = Object.freeze(styleObj);
          }
          compiledStyles = compileAndInsertAtomic(styleObj);
        }
        staticStyleMap.set(styleObj, compiledStyles);
      }
    });
    return styles16;
  }
  function compose(style1, style2) {
    if (false) {
      var len = arguments.length;
      if (len > 2) {
        var readableStyles = [...arguments].map((a) => flatten(a));
        throw new Error("StyleSheet.compose() only accepts 2 arguments, received " + len + ": " + JSON.stringify(readableStyles));
      }
    }
    return [style1, style2];
  }
  function flatten() {
    for (var _len = arguments.length, styles16 = new Array(_len), _key = 0; _key < _len; _key++) {
      styles16[_key] = arguments[_key];
    }
    var flatArray = styles16.flat(Infinity);
    var result = {};
    for (var i = 0; i < flatArray.length; i++) {
      var style = flatArray[i];
      if (style != null && typeof style === "object") {
        Object.assign(result, style);
      }
    }
    return result;
  }
  function getSheet() {
    return {
      id: sheet.id,
      textContent: sheet.getTextContent()
    };
  }
  function StyleSheet(styles16, options) {
    if (options === void 0) {
      options = {};
    }
    var isRTL = options.writingDirection === "rtl";
    var styleProps2 = customStyleq(styles16, options);
    if (Array.isArray(styleProps2) && styleProps2[1] != null) {
      styleProps2[1] = inline(styleProps2[1], isRTL);
    }
    return styleProps2;
  }
  StyleSheet.absoluteFill = absoluteFill;
  StyleSheet.absoluteFillObject = absoluteFillObject;
  StyleSheet.create = create;
  StyleSheet.compose = compose;
  StyleSheet.flatten = flatten;
  StyleSheet.getSheet = getSheet;
  StyleSheet.hairlineWidth = 1;
  if (canUseDom_default && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.resolveRNStyle = StyleSheet.flatten;
  }
  var stylesheet = StyleSheet;
  var StyleSheet_default = stylesheet;

  // node_modules/react-native-web/dist/modules/createDOMProps/index.js
  var _excluded3 = ["aria-activedescendant", "accessibilityActiveDescendant", "aria-atomic", "accessibilityAtomic", "aria-autocomplete", "accessibilityAutoComplete", "aria-busy", "accessibilityBusy", "aria-checked", "accessibilityChecked", "aria-colcount", "accessibilityColumnCount", "aria-colindex", "accessibilityColumnIndex", "aria-colspan", "accessibilityColumnSpan", "aria-controls", "accessibilityControls", "aria-current", "accessibilityCurrent", "aria-describedby", "accessibilityDescribedBy", "aria-details", "accessibilityDetails", "aria-disabled", "accessibilityDisabled", "aria-errormessage", "accessibilityErrorMessage", "aria-expanded", "accessibilityExpanded", "aria-flowto", "accessibilityFlowTo", "aria-haspopup", "accessibilityHasPopup", "aria-hidden", "accessibilityHidden", "aria-invalid", "accessibilityInvalid", "aria-keyshortcuts", "accessibilityKeyShortcuts", "aria-label", "accessibilityLabel", "aria-labelledby", "accessibilityLabelledBy", "aria-level", "accessibilityLevel", "aria-live", "accessibilityLiveRegion", "aria-modal", "accessibilityModal", "aria-multiline", "accessibilityMultiline", "aria-multiselectable", "accessibilityMultiSelectable", "aria-orientation", "accessibilityOrientation", "aria-owns", "accessibilityOwns", "aria-placeholder", "accessibilityPlaceholder", "aria-posinset", "accessibilityPosInSet", "aria-pressed", "accessibilityPressed", "aria-readonly", "accessibilityReadOnly", "aria-required", "accessibilityRequired", "role", "accessibilityRole", "aria-roledescription", "accessibilityRoleDescription", "aria-rowcount", "accessibilityRowCount", "aria-rowindex", "accessibilityRowIndex", "aria-rowspan", "accessibilityRowSpan", "aria-selected", "accessibilitySelected", "aria-setsize", "accessibilitySetSize", "aria-sort", "accessibilitySort", "aria-valuemax", "accessibilityValueMax", "aria-valuemin", "accessibilityValueMin", "aria-valuenow", "accessibilityValueNow", "aria-valuetext", "accessibilityValueText", "dataSet", "focusable", "id", "nativeID", "pointerEvents", "style", "tabIndex", "testID"];
  var emptyObject5 = {};
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var isArray = Array.isArray;
  var uppercasePattern2 = /[A-Z]/g;
  function toHyphenLower2(match) {
    return "-" + match.toLowerCase();
  }
  function hyphenateString(str) {
    return str.replace(uppercasePattern2, toHyphenLower2);
  }
  function processIDRefList(idRefList) {
    return isArray(idRefList) ? idRefList.join(" ") : idRefList;
  }
  var pointerEventsStyles = StyleSheet_default.create({
    auto: {
      pointerEvents: "auto"
    },
    "box-none": {
      pointerEvents: "box-none"
    },
    "box-only": {
      pointerEvents: "box-only"
    },
    none: {
      pointerEvents: "none"
    }
  });
  var createDOMProps = (elementType, props, options) => {
    if (!props) {
      props = emptyObject5;
    }
    var _props = props, ariaActiveDescendant = _props["aria-activedescendant"], accessibilityActiveDescendant = _props.accessibilityActiveDescendant, ariaAtomic = _props["aria-atomic"], accessibilityAtomic = _props.accessibilityAtomic, ariaAutoComplete = _props["aria-autocomplete"], accessibilityAutoComplete = _props.accessibilityAutoComplete, ariaBusy = _props["aria-busy"], accessibilityBusy = _props.accessibilityBusy, ariaChecked = _props["aria-checked"], accessibilityChecked = _props.accessibilityChecked, ariaColumnCount = _props["aria-colcount"], accessibilityColumnCount = _props.accessibilityColumnCount, ariaColumnIndex = _props["aria-colindex"], accessibilityColumnIndex = _props.accessibilityColumnIndex, ariaColumnSpan = _props["aria-colspan"], accessibilityColumnSpan = _props.accessibilityColumnSpan, ariaControls = _props["aria-controls"], accessibilityControls = _props.accessibilityControls, ariaCurrent = _props["aria-current"], accessibilityCurrent = _props.accessibilityCurrent, ariaDescribedBy = _props["aria-describedby"], accessibilityDescribedBy = _props.accessibilityDescribedBy, ariaDetails = _props["aria-details"], accessibilityDetails = _props.accessibilityDetails, ariaDisabled = _props["aria-disabled"], accessibilityDisabled = _props.accessibilityDisabled, ariaErrorMessage = _props["aria-errormessage"], accessibilityErrorMessage = _props.accessibilityErrorMessage, ariaExpanded = _props["aria-expanded"], accessibilityExpanded = _props.accessibilityExpanded, ariaFlowTo = _props["aria-flowto"], accessibilityFlowTo = _props.accessibilityFlowTo, ariaHasPopup = _props["aria-haspopup"], accessibilityHasPopup = _props.accessibilityHasPopup, ariaHidden = _props["aria-hidden"], accessibilityHidden = _props.accessibilityHidden, ariaInvalid = _props["aria-invalid"], accessibilityInvalid = _props.accessibilityInvalid, ariaKeyShortcuts = _props["aria-keyshortcuts"], accessibilityKeyShortcuts = _props.accessibilityKeyShortcuts, ariaLabel = _props["aria-label"], accessibilityLabel = _props.accessibilityLabel, ariaLabelledBy = _props["aria-labelledby"], accessibilityLabelledBy = _props.accessibilityLabelledBy, ariaLevel = _props["aria-level"], accessibilityLevel = _props.accessibilityLevel, ariaLive = _props["aria-live"], accessibilityLiveRegion = _props.accessibilityLiveRegion, ariaModal = _props["aria-modal"], accessibilityModal = _props.accessibilityModal, ariaMultiline = _props["aria-multiline"], accessibilityMultiline = _props.accessibilityMultiline, ariaMultiSelectable = _props["aria-multiselectable"], accessibilityMultiSelectable = _props.accessibilityMultiSelectable, ariaOrientation = _props["aria-orientation"], accessibilityOrientation = _props.accessibilityOrientation, ariaOwns = _props["aria-owns"], accessibilityOwns = _props.accessibilityOwns, ariaPlaceholder = _props["aria-placeholder"], accessibilityPlaceholder = _props.accessibilityPlaceholder, ariaPosInSet = _props["aria-posinset"], accessibilityPosInSet = _props.accessibilityPosInSet, ariaPressed = _props["aria-pressed"], accessibilityPressed = _props.accessibilityPressed, ariaReadOnly = _props["aria-readonly"], accessibilityReadOnly = _props.accessibilityReadOnly, ariaRequired = _props["aria-required"], accessibilityRequired = _props.accessibilityRequired, ariaRole = _props.role, accessibilityRole = _props.accessibilityRole, ariaRoleDescription = _props["aria-roledescription"], accessibilityRoleDescription = _props.accessibilityRoleDescription, ariaRowCount = _props["aria-rowcount"], accessibilityRowCount = _props.accessibilityRowCount, ariaRowIndex = _props["aria-rowindex"], accessibilityRowIndex = _props.accessibilityRowIndex, ariaRowSpan = _props["aria-rowspan"], accessibilityRowSpan = _props.accessibilityRowSpan, ariaSelected = _props["aria-selected"], accessibilitySelected = _props.accessibilitySelected, ariaSetSize = _props["aria-setsize"], accessibilitySetSize = _props.accessibilitySetSize, ariaSort = _props["aria-sort"], accessibilitySort = _props.accessibilitySort, ariaValueMax = _props["aria-valuemax"], accessibilityValueMax = _props.accessibilityValueMax, ariaValueMin = _props["aria-valuemin"], accessibilityValueMin = _props.accessibilityValueMin, ariaValueNow = _props["aria-valuenow"], accessibilityValueNow = _props.accessibilityValueNow, ariaValueText = _props["aria-valuetext"], accessibilityValueText = _props.accessibilityValueText, dataSet = _props.dataSet, focusable = _props.focusable, id = _props.id, nativeID = _props.nativeID, pointerEvents = _props.pointerEvents, style = _props.style, tabIndex = _props.tabIndex, testID = _props.testID, domProps = _objectWithoutPropertiesLoose(_props, _excluded3);
    var disabled = ariaDisabled || accessibilityDisabled;
    var role = AccessibilityUtil_default.propsToAriaRole(props);
    var _ariaActiveDescendant = ariaActiveDescendant != null ? ariaActiveDescendant : accessibilityActiveDescendant;
    if (_ariaActiveDescendant != null) {
      domProps["aria-activedescendant"] = _ariaActiveDescendant;
    }
    var _ariaAtomic = ariaAtomic != null ? ariaActiveDescendant : accessibilityAtomic;
    if (_ariaAtomic != null) {
      domProps["aria-atomic"] = _ariaAtomic;
    }
    var _ariaAutoComplete = ariaAutoComplete != null ? ariaAutoComplete : accessibilityAutoComplete;
    if (_ariaAutoComplete != null) {
      domProps["aria-autocomplete"] = _ariaAutoComplete;
    }
    var _ariaBusy = ariaBusy != null ? ariaBusy : accessibilityBusy;
    if (_ariaBusy != null) {
      domProps["aria-busy"] = _ariaBusy;
    }
    var _ariaChecked = ariaChecked != null ? ariaChecked : accessibilityChecked;
    if (_ariaChecked != null) {
      domProps["aria-checked"] = _ariaChecked;
    }
    var _ariaColumnCount = ariaColumnCount != null ? ariaColumnCount : accessibilityColumnCount;
    if (_ariaColumnCount != null) {
      domProps["aria-colcount"] = _ariaColumnCount;
    }
    var _ariaColumnIndex = ariaColumnIndex != null ? ariaColumnIndex : accessibilityColumnIndex;
    if (_ariaColumnIndex != null) {
      domProps["aria-colindex"] = _ariaColumnIndex;
    }
    var _ariaColumnSpan = ariaColumnSpan != null ? ariaColumnSpan : accessibilityColumnSpan;
    if (_ariaColumnSpan != null) {
      domProps["aria-colspan"] = _ariaColumnSpan;
    }
    var _ariaControls = ariaControls != null ? ariaControls : accessibilityControls;
    if (_ariaControls != null) {
      domProps["aria-controls"] = processIDRefList(_ariaControls);
    }
    var _ariaCurrent = ariaCurrent != null ? ariaCurrent : accessibilityCurrent;
    if (_ariaCurrent != null) {
      domProps["aria-current"] = _ariaCurrent;
    }
    var _ariaDescribedBy = ariaDescribedBy != null ? ariaDescribedBy : accessibilityDescribedBy;
    if (_ariaDescribedBy != null) {
      domProps["aria-describedby"] = processIDRefList(_ariaDescribedBy);
    }
    var _ariaDetails = ariaDetails != null ? ariaDetails : accessibilityDetails;
    if (_ariaDetails != null) {
      domProps["aria-details"] = _ariaDetails;
    }
    if (disabled === true) {
      domProps["aria-disabled"] = true;
      if (elementType === "button" || elementType === "form" || elementType === "input" || elementType === "select" || elementType === "textarea") {
        domProps.disabled = true;
      }
    }
    var _ariaErrorMessage = ariaErrorMessage != null ? ariaErrorMessage : accessibilityErrorMessage;
    if (_ariaErrorMessage != null) {
      domProps["aria-errormessage"] = _ariaErrorMessage;
    }
    var _ariaExpanded = ariaExpanded != null ? ariaExpanded : accessibilityExpanded;
    if (_ariaExpanded != null) {
      domProps["aria-expanded"] = _ariaExpanded;
    }
    var _ariaFlowTo = ariaFlowTo != null ? ariaFlowTo : accessibilityFlowTo;
    if (_ariaFlowTo != null) {
      domProps["aria-flowto"] = processIDRefList(_ariaFlowTo);
    }
    var _ariaHasPopup = ariaHasPopup != null ? ariaHasPopup : accessibilityHasPopup;
    if (_ariaHasPopup != null) {
      domProps["aria-haspopup"] = _ariaHasPopup;
    }
    var _ariaHidden = ariaHidden != null ? ariaHidden : accessibilityHidden;
    if (_ariaHidden === true) {
      domProps["aria-hidden"] = _ariaHidden;
    }
    var _ariaInvalid = ariaInvalid != null ? ariaInvalid : accessibilityInvalid;
    if (_ariaInvalid != null) {
      domProps["aria-invalid"] = _ariaInvalid;
    }
    var _ariaKeyShortcuts = ariaKeyShortcuts != null ? ariaKeyShortcuts : accessibilityKeyShortcuts;
    if (_ariaKeyShortcuts != null) {
      domProps["aria-keyshortcuts"] = processIDRefList(_ariaKeyShortcuts);
    }
    var _ariaLabel = ariaLabel != null ? ariaLabel : accessibilityLabel;
    if (_ariaLabel != null) {
      domProps["aria-label"] = _ariaLabel;
    }
    var _ariaLabelledBy = ariaLabelledBy != null ? ariaLabelledBy : accessibilityLabelledBy;
    if (_ariaLabelledBy != null) {
      domProps["aria-labelledby"] = processIDRefList(_ariaLabelledBy);
    }
    var _ariaLevel = ariaLevel != null ? ariaLevel : accessibilityLevel;
    if (_ariaLevel != null) {
      domProps["aria-level"] = _ariaLevel;
    }
    var _ariaLive = ariaLive != null ? ariaLive : accessibilityLiveRegion;
    if (_ariaLive != null) {
      domProps["aria-live"] = _ariaLive === "none" ? "off" : _ariaLive;
    }
    var _ariaModal = ariaModal != null ? ariaModal : accessibilityModal;
    if (_ariaModal != null) {
      domProps["aria-modal"] = _ariaModal;
    }
    var _ariaMultiline = ariaMultiline != null ? ariaMultiline : accessibilityMultiline;
    if (_ariaMultiline != null) {
      domProps["aria-multiline"] = _ariaMultiline;
    }
    var _ariaMultiSelectable = ariaMultiSelectable != null ? ariaMultiSelectable : accessibilityMultiSelectable;
    if (_ariaMultiSelectable != null) {
      domProps["aria-multiselectable"] = _ariaMultiSelectable;
    }
    var _ariaOrientation = ariaOrientation != null ? ariaOrientation : accessibilityOrientation;
    if (_ariaOrientation != null) {
      domProps["aria-orientation"] = _ariaOrientation;
    }
    var _ariaOwns = ariaOwns != null ? ariaOwns : accessibilityOwns;
    if (_ariaOwns != null) {
      domProps["aria-owns"] = processIDRefList(_ariaOwns);
    }
    var _ariaPlaceholder = ariaPlaceholder != null ? ariaPlaceholder : accessibilityPlaceholder;
    if (_ariaPlaceholder != null) {
      domProps["aria-placeholder"] = _ariaPlaceholder;
    }
    var _ariaPosInSet = ariaPosInSet != null ? ariaPosInSet : accessibilityPosInSet;
    if (_ariaPosInSet != null) {
      domProps["aria-posinset"] = _ariaPosInSet;
    }
    var _ariaPressed = ariaPressed != null ? ariaPressed : accessibilityPressed;
    if (_ariaPressed != null) {
      domProps["aria-pressed"] = _ariaPressed;
    }
    var _ariaReadOnly = ariaReadOnly != null ? ariaReadOnly : accessibilityReadOnly;
    if (_ariaReadOnly != null) {
      domProps["aria-readonly"] = _ariaReadOnly;
      if (elementType === "input" || elementType === "select" || elementType === "textarea") {
        domProps.readOnly = true;
      }
    }
    var _ariaRequired = ariaRequired != null ? ariaRequired : accessibilityRequired;
    if (_ariaRequired != null) {
      domProps["aria-required"] = _ariaRequired;
      if (elementType === "input" || elementType === "select" || elementType === "textarea") {
        domProps.required = accessibilityRequired;
      }
    }
    if (role != null) {
      domProps["role"] = role === "none" ? "presentation" : role;
    }
    var _ariaRoleDescription = ariaRoleDescription != null ? ariaRoleDescription : accessibilityRoleDescription;
    if (_ariaRoleDescription != null) {
      domProps["aria-roledescription"] = _ariaRoleDescription;
    }
    var _ariaRowCount = ariaRowCount != null ? ariaRowCount : accessibilityRowCount;
    if (_ariaRowCount != null) {
      domProps["aria-rowcount"] = _ariaRowCount;
    }
    var _ariaRowIndex = ariaRowIndex != null ? ariaRowIndex : accessibilityRowIndex;
    if (_ariaRowIndex != null) {
      domProps["aria-rowindex"] = _ariaRowIndex;
    }
    var _ariaRowSpan = ariaRowSpan != null ? ariaRowSpan : accessibilityRowSpan;
    if (_ariaRowSpan != null) {
      domProps["aria-rowspan"] = _ariaRowSpan;
    }
    var _ariaSelected = ariaSelected != null ? ariaSelected : accessibilitySelected;
    if (_ariaSelected != null) {
      domProps["aria-selected"] = _ariaSelected;
    }
    var _ariaSetSize = ariaSetSize != null ? ariaSetSize : accessibilitySetSize;
    if (_ariaSetSize != null) {
      domProps["aria-setsize"] = _ariaSetSize;
    }
    var _ariaSort = ariaSort != null ? ariaSort : accessibilitySort;
    if (_ariaSort != null) {
      domProps["aria-sort"] = _ariaSort;
    }
    var _ariaValueMax = ariaValueMax != null ? ariaValueMax : accessibilityValueMax;
    if (_ariaValueMax != null) {
      domProps["aria-valuemax"] = _ariaValueMax;
    }
    var _ariaValueMin = ariaValueMin != null ? ariaValueMin : accessibilityValueMin;
    if (_ariaValueMin != null) {
      domProps["aria-valuemin"] = _ariaValueMin;
    }
    var _ariaValueNow = ariaValueNow != null ? ariaValueNow : accessibilityValueNow;
    if (_ariaValueNow != null) {
      domProps["aria-valuenow"] = _ariaValueNow;
    }
    var _ariaValueText = ariaValueText != null ? ariaValueText : accessibilityValueText;
    if (_ariaValueText != null) {
      domProps["aria-valuetext"] = _ariaValueText;
    }
    if (dataSet != null) {
      for (var dataProp in dataSet) {
        if (hasOwnProperty.call(dataSet, dataProp)) {
          var dataName = hyphenateString(dataProp);
          var dataValue = dataSet[dataProp];
          if (dataValue != null) {
            domProps["data-" + dataName] = dataValue;
          }
        }
      }
    }
    if (tabIndex === 0 || tabIndex === "0" || tabIndex === -1 || tabIndex === "-1") {
      domProps.tabIndex = tabIndex;
    } else {
      if (focusable === false) {
        domProps.tabIndex = "-1";
      }
      if (
        // These native elements are keyboard focusable by default
        elementType === "a" || elementType === "button" || elementType === "input" || elementType === "select" || elementType === "textarea"
      ) {
        if (focusable === false || accessibilityDisabled === true) {
          domProps.tabIndex = "-1";
        }
      } else if (
        // These roles are made keyboard focusable by default
        role === "button" || role === "checkbox" || role === "link" || role === "radio" || role === "textbox" || role === "switch"
      ) {
        if (focusable !== false) {
          domProps.tabIndex = "0";
        }
      } else {
        if (focusable === true) {
          domProps.tabIndex = "0";
        }
      }
    }
    if (pointerEvents != null) {
      warnOnce("pointerEvents", "props.pointerEvents is deprecated. Use style.pointerEvents");
    }
    var _StyleSheet = StyleSheet_default([style, pointerEvents && pointerEventsStyles[pointerEvents]], _objectSpread2({
      writingDirection: "ltr"
    }, options)), className = _StyleSheet[0], inlineStyle = _StyleSheet[1];
    if (className) {
      domProps.className = className;
    }
    if (inlineStyle) {
      domProps.style = inlineStyle;
    }
    var _id = id != null ? id : nativeID;
    if (_id != null) {
      domProps.id = _id;
    }
    if (testID != null) {
      domProps["data-testid"] = testID;
    }
    if (domProps.type == null && elementType === "button") {
      domProps.type = "button";
    }
    return domProps;
  };
  var createDOMProps_default = createDOMProps;

  // node_modules/react-native-web/dist/exports/createElement/index.js
  var import_react2 = __toESM(require_react());

  // node_modules/react-native-web/dist/modules/useLocale/index.js
  var import_react = __toESM(require_react());

  // node_modules/react-native-web/dist/modules/useLocale/isLocaleRTL.js
  var rtlScripts = /* @__PURE__ */ new Set(["Arab", "Syrc", "Samr", "Mand", "Thaa", "Mend", "Nkoo", "Adlm", "Rohg", "Hebr"]);
  var rtlLangs = /* @__PURE__ */ new Set([
    "ae",
    // Avestan
    "ar",
    // Arabic
    "arc",
    // Aramaic
    "bcc",
    // Southern Balochi
    "bqi",
    // Bakthiari
    "ckb",
    // Sorani
    "dv",
    // Dhivehi
    "fa",
    "far",
    // Persian
    "glk",
    // Gilaki
    "he",
    "iw",
    // Hebrew
    "khw",
    // Khowar
    "ks",
    // Kashmiri
    "ku",
    // Kurdish
    "mzn",
    // Mazanderani
    "nqo",
    // N'Ko
    "pnb",
    // Western Punjabi
    "ps",
    // Pashto
    "sd",
    // Sindhi
    "ug",
    // Uyghur
    "ur",
    // Urdu
    "yi"
    // Yiddish
  ]);
  var cache3 = /* @__PURE__ */ new Map();
  function isLocaleRTL(locale) {
    var cachedRTL = cache3.get(locale);
    if (cachedRTL) {
      return cachedRTL;
    }
    var isRTL = false;
    if (Intl.Locale) {
      try {
        var script = new Intl.Locale(locale).maximize().script;
        isRTL = rtlScripts.has(script);
      } catch (_unused) {
        var lang = locale.split("-")[0];
        isRTL = rtlLangs.has(lang);
      }
    } else {
      var _lang = locale.split("-")[0];
      isRTL = rtlLangs.has(_lang);
    }
    cache3.set(locale, isRTL);
    return isRTL;
  }

  // node_modules/react-native-web/dist/modules/useLocale/index.js
  var defaultLocale = {
    direction: "ltr",
    locale: "en-US"
  };
  var LocaleContext = /* @__PURE__ */ (0, import_react.createContext)(defaultLocale);
  function getLocaleDirection(locale) {
    return isLocaleRTL(locale) ? "rtl" : "ltr";
  }
  function LocaleProvider(props) {
    var direction = props.direction, locale = props.locale, children = props.children;
    var needsContext = direction || locale;
    return needsContext ? /* @__PURE__ */ import_react.default.createElement(LocaleContext.Provider, {
      children,
      value: {
        direction: locale ? getLocaleDirection(locale) : direction,
        locale
      }
    }) : children;
  }
  function useLocaleContext() {
    return (0, import_react.useContext)(LocaleContext);
  }

  // node_modules/react-native-web/dist/exports/createElement/index.js
  var createElement = (component, props, options) => {
    var accessibilityComponent;
    if (component && component.constructor === String) {
      accessibilityComponent = AccessibilityUtil_default.propsToAccessibilityComponent(props);
    }
    var Component2 = accessibilityComponent || component;
    var domProps = createDOMProps_default(Component2, props, options);
    var element = /* @__PURE__ */ import_react2.default.createElement(Component2, domProps);
    var elementWithLocaleProvider = domProps.dir ? /* @__PURE__ */ import_react2.default.createElement(LocaleProvider, {
      children: element,
      direction: domProps.dir,
      locale: domProps.lang
    }) : element;
    return elementWithLocaleProvider;
  };
  var createElement_default = createElement;

  // node_modules/react-native-web/dist/modules/getBoundingClientRect/index.js
  var getBoundingClientRect = (node) => {
    if (node != null) {
      var isElement = node.nodeType === 1;
      if (isElement && typeof node.getBoundingClientRect === "function") {
        return node.getBoundingClientRect();
      }
    }
  };
  var getBoundingClientRect_default = getBoundingClientRect;

  // node_modules/react-native-web/dist/modules/unitlessNumbers/index.js
  var unitlessNumbers2 = {
    animationIterationCount: true,
    aspectRatio: true,
    borderImageOutset: true,
    borderImageSlice: true,
    borderImageWidth: true,
    boxFlex: true,
    boxFlexGroup: true,
    boxOrdinalGroup: true,
    columnCount: true,
    flex: true,
    flexGrow: true,
    flexOrder: true,
    flexPositive: true,
    flexShrink: true,
    flexNegative: true,
    fontWeight: true,
    gridRow: true,
    gridRowEnd: true,
    gridRowGap: true,
    gridRowStart: true,
    gridColumn: true,
    gridColumnEnd: true,
    gridColumnGap: true,
    gridColumnStart: true,
    lineClamp: true,
    opacity: true,
    order: true,
    orphans: true,
    tabSize: true,
    widows: true,
    zIndex: true,
    zoom: true,
    // SVG-related
    fillOpacity: true,
    floodOpacity: true,
    stopOpacity: true,
    strokeDasharray: true,
    strokeDashoffset: true,
    strokeMiterlimit: true,
    strokeOpacity: true,
    strokeWidth: true,
    // transform types
    scale: true,
    scaleX: true,
    scaleY: true,
    scaleZ: true,
    // RN properties
    shadowOpacity: true
  };
  var prefixes2 = ["ms", "Moz", "O", "Webkit"];
  var prefixKey2 = (prefix, key) => {
    return prefix + key.charAt(0).toUpperCase() + key.substring(1);
  };
  Object.keys(unitlessNumbers2).forEach((prop) => {
    prefixes2.forEach((prefix) => {
      unitlessNumbers2[prefixKey2(prefix, prop)] = unitlessNumbers2[prop];
    });
  });
  var unitlessNumbers_default2 = unitlessNumbers2;

  // node_modules/react-native-web/dist/modules/setValueForStyles/dangerousStyleValue.js
  function dangerousStyleValue(name, value, isCustomProperty) {
    var isEmpty = value == null || typeof value === "boolean" || value === "";
    if (isEmpty) {
      return "";
    }
    if (!isCustomProperty && typeof value === "number" && value !== 0 && !(unitlessNumbers_default2.hasOwnProperty(name) && unitlessNumbers_default2[name])) {
      return value + "px";
    }
    return ("" + value).trim();
  }
  var dangerousStyleValue_default = dangerousStyleValue;

  // node_modules/react-native-web/dist/modules/setValueForStyles/index.js
  function setValueForStyles(node, styles16) {
    var style = node.style;
    for (var styleName in styles16) {
      if (!styles16.hasOwnProperty(styleName)) {
        continue;
      }
      var isCustomProperty = styleName.indexOf("--") === 0;
      var styleValue = dangerousStyleValue_default(styleName, styles16[styleName], isCustomProperty);
      if (styleName === "float") {
        styleName = "cssFloat";
      }
      if (isCustomProperty) {
        style.setProperty(styleName, styleValue);
      } else {
        style[styleName] = styleValue;
      }
    }
  }
  var setValueForStyles_default = setValueForStyles;

  // node_modules/react-native-web/dist/exports/UIManager/index.js
  var getRect = (node) => {
    var height = node.offsetHeight;
    var width = node.offsetWidth;
    var left2 = node.offsetLeft;
    var top = node.offsetTop;
    node = node.offsetParent;
    while (node && node.nodeType === 1) {
      left2 += node.offsetLeft + node.clientLeft - node.scrollLeft;
      top += node.offsetTop + node.clientTop - node.scrollTop;
      node = node.offsetParent;
    }
    top -= window.scrollY;
    left2 -= window.scrollX;
    return {
      width,
      height,
      top,
      left: left2
    };
  };
  var measureLayout = (node, relativeToNativeNode, callback) => {
    var relativeNode = relativeToNativeNode || node && node.parentNode;
    if (node && relativeNode) {
      setTimeout(() => {
        if (node.isConnected && relativeNode.isConnected) {
          var relativeRect = getRect(relativeNode);
          var _getRect = getRect(node), height = _getRect.height, left2 = _getRect.left, top = _getRect.top, width = _getRect.width;
          var x = left2 - relativeRect.left;
          var y = top - relativeRect.top;
          callback(x, y, width, height, left2, top);
        }
      }, 0);
    }
  };
  var elementsToIgnore = {
    A: true,
    BODY: true,
    INPUT: true,
    SELECT: true,
    TEXTAREA: true
  };
  var UIManager = {
    blur(node) {
      try {
        node.blur();
      } catch (err) {
      }
    },
    focus(node) {
      try {
        var name = node.nodeName;
        if (node.getAttribute("tabIndex") == null && node.isContentEditable !== true && elementsToIgnore[name] == null) {
          node.setAttribute("tabIndex", "-1");
        }
        node.focus();
      } catch (err) {
      }
    },
    measure(node, callback) {
      measureLayout(node, null, callback);
    },
    measureInWindow(node, callback) {
      if (node) {
        setTimeout(() => {
          var _getBoundingClientRec = getBoundingClientRect_default(node), height = _getBoundingClientRec.height, left2 = _getBoundingClientRec.left, top = _getBoundingClientRec.top, width = _getBoundingClientRec.width;
          callback(left2, top, width, height);
        }, 0);
      }
    },
    measureLayout(node, relativeToNativeNode, onFail, onSuccess) {
      measureLayout(node, relativeToNativeNode, onSuccess);
    },
    updateView(node, props) {
      for (var prop in props) {
        if (!Object.prototype.hasOwnProperty.call(props, prop)) {
          continue;
        }
        var value = props[prop];
        switch (prop) {
          case "style": {
            setValueForStyles_default(node, value);
            break;
          }
          case "class":
          case "className": {
            node.setAttribute("class", value);
            break;
          }
          case "text":
          case "value":
            node.value = value;
            break;
          default:
            node.setAttribute(prop, value);
        }
      }
    },
    configureNextLayoutAnimation(config, onAnimationDidEnd) {
      onAnimationDidEnd();
    },
    // mocks
    setLayoutAnimationEnabledExperimental() {
    }
  };
  var UIManager_default = UIManager;

  // node_modules/react-native-web/dist/exports/Platform/index.js
  var Platform = {
    OS: "web",
    select: (obj) => "web" in obj ? obj.web : obj.default,
    get isTesting() {
      if (false) {
        return true;
      }
      return false;
    },
    get Version() {
      return "0.0.0";
    }
  };
  var Platform_default = Platform;

  // node_modules/react-native-web/node_modules/@babel/runtime/helpers/esm/extends.js
  function _extends() {
    return _extends = Object.assign ? Object.assign.bind() : function(n) {
      for (var e = 1; e < arguments.length; e++) {
        var t = arguments[e];
        for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
      }
      return n;
    }, _extends.apply(null, arguments);
  }

  // node_modules/react-native-web/dist/exports/View/index.js
  var React7 = __toESM(require_react());

  // node_modules/react-native-web/dist/modules/forwardedProps/index.js
  var defaultProps = {
    children: true,
    dataSet: true,
    dir: true,
    id: true,
    ref: true,
    suppressHydrationWarning: true,
    tabIndex: true,
    testID: true,
    // @deprecated
    focusable: true,
    nativeID: true
  };
  var accessibilityProps = {
    "aria-activedescendant": true,
    "aria-atomic": true,
    "aria-autocomplete": true,
    "aria-busy": true,
    "aria-checked": true,
    "aria-colcount": true,
    "aria-colindex": true,
    "aria-colspan": true,
    "aria-controls": true,
    "aria-current": true,
    "aria-describedby": true,
    "aria-details": true,
    "aria-disabled": true,
    "aria-errormessage": true,
    "aria-expanded": true,
    "aria-flowto": true,
    "aria-haspopup": true,
    "aria-hidden": true,
    "aria-invalid": true,
    "aria-keyshortcuts": true,
    "aria-label": true,
    "aria-labelledby": true,
    "aria-level": true,
    "aria-live": true,
    "aria-modal": true,
    "aria-multiline": true,
    "aria-multiselectable": true,
    "aria-orientation": true,
    "aria-owns": true,
    "aria-placeholder": true,
    "aria-posinset": true,
    "aria-pressed": true,
    "aria-readonly": true,
    "aria-required": true,
    inert: true,
    role: true,
    "aria-roledescription": true,
    "aria-rowcount": true,
    "aria-rowindex": true,
    "aria-rowspan": true,
    "aria-selected": true,
    "aria-setsize": true,
    "aria-sort": true,
    "aria-valuemax": true,
    "aria-valuemin": true,
    "aria-valuenow": true,
    "aria-valuetext": true,
    // @deprecated
    accessibilityActiveDescendant: true,
    accessibilityAtomic: true,
    accessibilityAutoComplete: true,
    accessibilityBusy: true,
    accessibilityChecked: true,
    accessibilityColumnCount: true,
    accessibilityColumnIndex: true,
    accessibilityColumnSpan: true,
    accessibilityControls: true,
    accessibilityCurrent: true,
    accessibilityDescribedBy: true,
    accessibilityDetails: true,
    accessibilityDisabled: true,
    accessibilityErrorMessage: true,
    accessibilityExpanded: true,
    accessibilityFlowTo: true,
    accessibilityHasPopup: true,
    accessibilityHidden: true,
    accessibilityInvalid: true,
    accessibilityKeyShortcuts: true,
    accessibilityLabel: true,
    accessibilityLabelledBy: true,
    accessibilityLevel: true,
    accessibilityLiveRegion: true,
    accessibilityModal: true,
    accessibilityMultiline: true,
    accessibilityMultiSelectable: true,
    accessibilityOrientation: true,
    accessibilityOwns: true,
    accessibilityPlaceholder: true,
    accessibilityPosInSet: true,
    accessibilityPressed: true,
    accessibilityReadOnly: true,
    accessibilityRequired: true,
    accessibilityRole: true,
    accessibilityRoleDescription: true,
    accessibilityRowCount: true,
    accessibilityRowIndex: true,
    accessibilityRowSpan: true,
    accessibilitySelected: true,
    accessibilitySetSize: true,
    accessibilitySort: true,
    accessibilityValueMax: true,
    accessibilityValueMin: true,
    accessibilityValueNow: true,
    accessibilityValueText: true
  };
  var clickProps = {
    onClick: true,
    onAuxClick: true,
    onContextMenu: true,
    onGotPointerCapture: true,
    onLostPointerCapture: true,
    onPointerCancel: true,
    onPointerDown: true,
    onPointerEnter: true,
    onPointerMove: true,
    onPointerLeave: true,
    onPointerOut: true,
    onPointerOver: true,
    onPointerUp: true
  };
  var focusProps = {
    onBlur: true,
    onFocus: true
  };
  var keyboardProps = {
    onKeyDown: true,
    onKeyDownCapture: true,
    onKeyUp: true,
    onKeyUpCapture: true
  };
  var mouseProps = {
    onMouseDown: true,
    onMouseEnter: true,
    onMouseLeave: true,
    onMouseMove: true,
    onMouseOver: true,
    onMouseOut: true,
    onMouseUp: true
  };
  var touchProps = {
    onTouchCancel: true,
    onTouchCancelCapture: true,
    onTouchEnd: true,
    onTouchEndCapture: true,
    onTouchMove: true,
    onTouchMoveCapture: true,
    onTouchStart: true,
    onTouchStartCapture: true
  };
  var styleProps = {
    style: true
  };

  // node_modules/react-native-web/dist/modules/pick/index.js
  function pick(obj, list) {
    var nextObj = {};
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (list[key] === true) {
          nextObj[key] = obj[key];
        }
      }
    }
    return nextObj;
  }

  // node_modules/react-native-web/dist/modules/useLayoutEffect/index.js
  var import_react3 = __toESM(require_react());
  var useLayoutEffectImpl = canUseDom_default ? import_react3.useLayoutEffect : import_react3.useEffect;
  var useLayoutEffect_default = useLayoutEffectImpl;

  // node_modules/react-native-web/dist/modules/useElementLayout/index.js
  var DOM_LAYOUT_HANDLER_NAME = "__reactLayoutHandler";
  var didWarn = !canUseDom_default;
  var resizeObserver = null;
  function getResizeObserver() {
    if (canUseDom_default && typeof window.ResizeObserver !== "undefined") {
      if (resizeObserver == null) {
        resizeObserver = new window.ResizeObserver(function(entries) {
          entries.forEach((entry) => {
            var node = entry.target;
            var onLayout = node[DOM_LAYOUT_HANDLER_NAME];
            if (typeof onLayout === "function") {
              UIManager_default.measure(node, (x, y, width, height, left2, top) => {
                var event = {
                  // $FlowFixMe
                  nativeEvent: {
                    layout: {
                      x,
                      y,
                      width,
                      height,
                      left: left2,
                      top
                    }
                  },
                  timeStamp: Date.now()
                };
                Object.defineProperty(event.nativeEvent, "target", {
                  enumerable: true,
                  get: () => entry.target
                });
                onLayout(event);
              });
            }
          });
        });
      }
    } else if (!didWarn) {
      if (false) {
        console.warn("onLayout relies on ResizeObserver which is not supported by your browser. Please include a polyfill, e.g., https://github.com/que-etc/resize-observer-polyfill.");
        didWarn = true;
      }
    }
    return resizeObserver;
  }
  function useElementLayout(ref, onLayout) {
    var observer = getResizeObserver();
    useLayoutEffect_default(() => {
      var node = ref.current;
      if (node != null) {
        node[DOM_LAYOUT_HANDLER_NAME] = onLayout;
      }
    }, [ref, onLayout]);
    useLayoutEffect_default(() => {
      var node = ref.current;
      if (node != null && observer != null) {
        if (typeof node[DOM_LAYOUT_HANDLER_NAME] === "function") {
          observer.observe(node);
        } else {
          observer.unobserve(node);
        }
      }
      return () => {
        if (node != null && observer != null) {
          observer.unobserve(node);
        }
      };
    }, [ref, observer]);
  }

  // node_modules/react-native-web/dist/modules/useMergeRefs/index.js
  var React4 = __toESM(require_react());

  // node_modules/react-native-web/dist/modules/mergeRefs/index.js
  var React3 = __toESM(require_react());
  function mergeRefs() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    return function forwardRef9(node) {
      args.forEach((ref) => {
        if (ref == null) {
          return;
        }
        if (typeof ref === "function") {
          ref(node);
          return;
        }
        if (typeof ref === "object") {
          ref.current = node;
          return;
        }
        console.error("mergeRefs cannot handle Refs of type boolean, number or string, received ref " + String(ref));
      });
    };
  }

  // node_modules/react-native-web/dist/modules/useMergeRefs/index.js
  function useMergeRefs() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    return React4.useMemo(
      () => mergeRefs(...args),
      // eslint-disable-next-line
      [...args]
    );
  }

  // node_modules/react-native-web/dist/modules/useStable/index.js
  var React5 = __toESM(require_react());
  var UNINITIALIZED = typeof Symbol === "function" && typeof /* @__PURE__ */ Symbol() === "symbol" ? /* @__PURE__ */ Symbol() : Object.freeze({});
  function useStable(getInitialValue) {
    var ref = React5.useRef(UNINITIALIZED);
    if (ref.current === UNINITIALIZED) {
      ref.current = getInitialValue();
    }
    return ref.current;
  }

  // node_modules/react-native-web/dist/modules/usePlatformMethods/index.js
  function usePlatformMethods(_ref) {
    var pointerEvents = _ref.pointerEvents, style = _ref.style;
    var ref = useStable(() => (hostNode) => {
      if (hostNode != null) {
        hostNode.measure = (callback) => UIManager_default.measure(hostNode, callback);
        hostNode.measureLayout = (relativeToNode, success, failure) => UIManager_default.measureLayout(hostNode, relativeToNode, failure, success);
        hostNode.measureInWindow = (callback) => UIManager_default.measureInWindow(hostNode, callback);
      }
    });
    return ref;
  }

  // node_modules/react-native-web/dist/modules/useResponderEvents/index.js
  var React6 = __toESM(require_react());

  // node_modules/react-native-web/dist/modules/useResponderEvents/createResponderEvent.js
  var emptyFunction = () => {
  };
  var emptyObject6 = {};
  var emptyArray = [];
  function normalizeIdentifier(identifier) {
    return identifier > 20 ? identifier % 20 : identifier;
  }
  function createResponderEvent(domEvent, responderTouchHistoryStore2) {
    var rect;
    var propagationWasStopped = false;
    var changedTouches;
    var touches;
    var domEventChangedTouches = domEvent.changedTouches;
    var domEventType = domEvent.type;
    var metaKey = domEvent.metaKey === true;
    var shiftKey = domEvent.shiftKey === true;
    var force = domEventChangedTouches && domEventChangedTouches[0].force || 0;
    var identifier = normalizeIdentifier(domEventChangedTouches && domEventChangedTouches[0].identifier || 0);
    var clientX = domEventChangedTouches && domEventChangedTouches[0].clientX || domEvent.clientX;
    var clientY = domEventChangedTouches && domEventChangedTouches[0].clientY || domEvent.clientY;
    var pageX = domEventChangedTouches && domEventChangedTouches[0].pageX || domEvent.pageX;
    var pageY = domEventChangedTouches && domEventChangedTouches[0].pageY || domEvent.pageY;
    var preventDefault = typeof domEvent.preventDefault === "function" ? domEvent.preventDefault.bind(domEvent) : emptyFunction;
    var timestamp = domEvent.timeStamp;
    function normalizeTouches(touches2) {
      return Array.prototype.slice.call(touches2).map((touch) => {
        return {
          force: touch.force,
          identifier: normalizeIdentifier(touch.identifier),
          get locationX() {
            return locationX(touch.clientX);
          },
          get locationY() {
            return locationY(touch.clientY);
          },
          pageX: touch.pageX,
          pageY: touch.pageY,
          target: touch.target,
          timestamp
        };
      });
    }
    if (domEventChangedTouches != null) {
      changedTouches = normalizeTouches(domEventChangedTouches);
      touches = normalizeTouches(domEvent.touches);
    } else {
      var emulatedTouches = [{
        force,
        identifier,
        get locationX() {
          return locationX(clientX);
        },
        get locationY() {
          return locationY(clientY);
        },
        pageX,
        pageY,
        target: domEvent.target,
        timestamp
      }];
      changedTouches = emulatedTouches;
      touches = domEventType === "mouseup" || domEventType === "dragstart" ? emptyArray : emulatedTouches;
    }
    var responderEvent = {
      bubbles: true,
      cancelable: true,
      // `currentTarget` is set before dispatch
      currentTarget: null,
      defaultPrevented: domEvent.defaultPrevented,
      dispatchConfig: emptyObject6,
      eventPhase: domEvent.eventPhase,
      isDefaultPrevented() {
        return domEvent.defaultPrevented;
      },
      isPropagationStopped() {
        return propagationWasStopped;
      },
      isTrusted: domEvent.isTrusted,
      nativeEvent: {
        altKey: false,
        ctrlKey: false,
        metaKey,
        shiftKey,
        changedTouches,
        force,
        identifier,
        get locationX() {
          return locationX(clientX);
        },
        get locationY() {
          return locationY(clientY);
        },
        pageX,
        pageY,
        target: domEvent.target,
        timestamp,
        touches,
        type: domEventType
      },
      persist: emptyFunction,
      preventDefault,
      stopPropagation() {
        propagationWasStopped = true;
      },
      target: domEvent.target,
      timeStamp: timestamp,
      touchHistory: responderTouchHistoryStore2.touchHistory
    };
    function locationX(x) {
      rect = rect || getBoundingClientRect_default(responderEvent.currentTarget);
      if (rect) {
        return x - rect.left;
      }
    }
    function locationY(y) {
      rect = rect || getBoundingClientRect_default(responderEvent.currentTarget);
      if (rect) {
        return y - rect.top;
      }
    }
    return responderEvent;
  }

  // node_modules/react-native-web/dist/modules/useResponderEvents/ResponderEventTypes.js
  var MOUSE_DOWN = "mousedown";
  var MOUSE_MOVE = "mousemove";
  var MOUSE_UP = "mouseup";
  var MOUSE_CANCEL = "dragstart";
  var TOUCH_START = "touchstart";
  var TOUCH_MOVE = "touchmove";
  var TOUCH_END = "touchend";
  var TOUCH_CANCEL = "touchcancel";
  var SCROLL = "scroll";
  var SELECT = "select";
  var SELECTION_CHANGE = "selectionchange";
  function isStartish(eventType) {
    return eventType === TOUCH_START || eventType === MOUSE_DOWN;
  }
  function isMoveish(eventType) {
    return eventType === TOUCH_MOVE || eventType === MOUSE_MOVE;
  }
  function isEndish(eventType) {
    return eventType === TOUCH_END || eventType === MOUSE_UP || isCancelish(eventType);
  }
  function isCancelish(eventType) {
    return eventType === TOUCH_CANCEL || eventType === MOUSE_CANCEL;
  }
  function isScroll(eventType) {
    return eventType === SCROLL;
  }
  function isSelectionChange(eventType) {
    return eventType === SELECT || eventType === SELECTION_CHANGE;
  }

  // node_modules/react-native-web/dist/modules/isSelectionValid/index.js
  function isSelectionValid() {
    var selection = window.getSelection();
    var string = selection.toString();
    var anchorNode = selection.anchorNode;
    var focusNode = selection.focusNode;
    var isTextNode = anchorNode && anchorNode.nodeType === window.Node.TEXT_NODE || focusNode && focusNode.nodeType === window.Node.TEXT_NODE;
    return string.length >= 1 && string !== "\n" && isTextNode;
  }

  // node_modules/react-native-web/dist/modules/useResponderEvents/utils.js
  var keyName = "__reactResponderId";
  function getEventPath(domEvent) {
    if (domEvent.type === "selectionchange") {
      var target = window.getSelection().anchorNode;
      return composedPathFallback(target);
    } else {
      var path = domEvent.composedPath != null ? domEvent.composedPath() : composedPathFallback(domEvent.target);
      return path;
    }
  }
  function composedPathFallback(target) {
    var path = [];
    while (target != null && target !== document.body) {
      path.push(target);
      target = target.parentNode;
    }
    return path;
  }
  function getResponderId(node) {
    if (node != null) {
      return node[keyName];
    }
    return null;
  }
  function setResponderId(node, id) {
    if (node != null) {
      node[keyName] = id;
    }
  }
  function getResponderPaths(domEvent) {
    var idPath = [];
    var nodePath = [];
    var eventPath = getEventPath(domEvent);
    for (var i = 0; i < eventPath.length; i++) {
      var node = eventPath[i];
      var id = getResponderId(node);
      if (id != null) {
        idPath.push(id);
        nodePath.push(node);
      }
    }
    return {
      idPath,
      nodePath
    };
  }
  function getLowestCommonAncestor(pathA, pathB) {
    var pathALength = pathA.length;
    var pathBLength = pathB.length;
    if (
      // If either path is empty
      pathALength === 0 || pathBLength === 0 || // If the last elements aren't the same there can't be a common ancestor
      // that is connected to the responder system
      pathA[pathALength - 1] !== pathB[pathBLength - 1]
    ) {
      return null;
    }
    var itemA = pathA[0];
    var indexA = 0;
    var itemB = pathB[0];
    var indexB = 0;
    if (pathALength - pathBLength > 0) {
      indexA = pathALength - pathBLength;
      itemA = pathA[indexA];
      pathALength = pathBLength;
    }
    if (pathBLength - pathALength > 0) {
      indexB = pathBLength - pathALength;
      itemB = pathB[indexB];
      pathBLength = pathALength;
    }
    var depth = pathALength;
    while (depth--) {
      if (itemA === itemB) {
        return itemA;
      }
      itemA = pathA[indexA++];
      itemB = pathB[indexB++];
    }
    return null;
  }
  function hasTargetTouches(target, touches) {
    if (!touches || touches.length === 0) {
      return false;
    }
    for (var i = 0; i < touches.length; i++) {
      var node = touches[i].target;
      if (node != null) {
        if (target.contains(node)) {
          return true;
        }
      }
    }
    return false;
  }
  function hasValidSelection(domEvent) {
    if (domEvent.type === "selectionchange") {
      return isSelectionValid();
    }
    return domEvent.type === "select";
  }
  function isPrimaryPointerDown(domEvent) {
    var altKey = domEvent.altKey, button = domEvent.button, buttons = domEvent.buttons, ctrlKey = domEvent.ctrlKey, type = domEvent.type;
    var isTouch = type === "touchstart" || type === "touchmove";
    var isPrimaryMouseDown = type === "mousedown" && (button === 0 || buttons === 1);
    var isPrimaryMouseMove = type === "mousemove" && buttons === 1;
    var noModifiers = altKey === false && ctrlKey === false;
    if (isTouch || isPrimaryMouseDown && noModifiers || isPrimaryMouseMove && noModifiers) {
      return true;
    }
    return false;
  }

  // node_modules/react-native-web/dist/modules/useResponderEvents/ResponderTouchHistoryStore.js
  var __DEV__ = false;
  var MAX_TOUCH_BANK = 20;
  function timestampForTouch(touch) {
    return touch.timeStamp || touch.timestamp;
  }
  function createTouchRecord(touch) {
    return {
      touchActive: true,
      startPageX: touch.pageX,
      startPageY: touch.pageY,
      startTimeStamp: timestampForTouch(touch),
      currentPageX: touch.pageX,
      currentPageY: touch.pageY,
      currentTimeStamp: timestampForTouch(touch),
      previousPageX: touch.pageX,
      previousPageY: touch.pageY,
      previousTimeStamp: timestampForTouch(touch)
    };
  }
  function resetTouchRecord(touchRecord, touch) {
    touchRecord.touchActive = true;
    touchRecord.startPageX = touch.pageX;
    touchRecord.startPageY = touch.pageY;
    touchRecord.startTimeStamp = timestampForTouch(touch);
    touchRecord.currentPageX = touch.pageX;
    touchRecord.currentPageY = touch.pageY;
    touchRecord.currentTimeStamp = timestampForTouch(touch);
    touchRecord.previousPageX = touch.pageX;
    touchRecord.previousPageY = touch.pageY;
    touchRecord.previousTimeStamp = timestampForTouch(touch);
  }
  function getTouchIdentifier(_ref) {
    var identifier = _ref.identifier;
    if (identifier == null) {
      console.error("Touch object is missing identifier.");
    }
    if (__DEV__) {
      if (identifier > MAX_TOUCH_BANK) {
        console.error("Touch identifier %s is greater than maximum supported %s which causes performance issues backfilling array locations for all of the indices.", identifier, MAX_TOUCH_BANK);
      }
    }
    return identifier;
  }
  function recordTouchStart(touch, touchHistory) {
    var identifier = getTouchIdentifier(touch);
    var touchRecord = touchHistory.touchBank[identifier];
    if (touchRecord) {
      resetTouchRecord(touchRecord, touch);
    } else {
      touchHistory.touchBank[identifier] = createTouchRecord(touch);
    }
    touchHistory.mostRecentTimeStamp = timestampForTouch(touch);
  }
  function recordTouchMove(touch, touchHistory) {
    var touchRecord = touchHistory.touchBank[getTouchIdentifier(touch)];
    if (touchRecord) {
      touchRecord.touchActive = true;
      touchRecord.previousPageX = touchRecord.currentPageX;
      touchRecord.previousPageY = touchRecord.currentPageY;
      touchRecord.previousTimeStamp = touchRecord.currentTimeStamp;
      touchRecord.currentPageX = touch.pageX;
      touchRecord.currentPageY = touch.pageY;
      touchRecord.currentTimeStamp = timestampForTouch(touch);
      touchHistory.mostRecentTimeStamp = timestampForTouch(touch);
    } else {
      console.warn("Cannot record touch move without a touch start.\n", "Touch Move: " + printTouch(touch) + "\n", "Touch Bank: " + printTouchBank(touchHistory));
    }
  }
  function recordTouchEnd(touch, touchHistory) {
    var touchRecord = touchHistory.touchBank[getTouchIdentifier(touch)];
    if (touchRecord) {
      touchRecord.touchActive = false;
      touchRecord.previousPageX = touchRecord.currentPageX;
      touchRecord.previousPageY = touchRecord.currentPageY;
      touchRecord.previousTimeStamp = touchRecord.currentTimeStamp;
      touchRecord.currentPageX = touch.pageX;
      touchRecord.currentPageY = touch.pageY;
      touchRecord.currentTimeStamp = timestampForTouch(touch);
      touchHistory.mostRecentTimeStamp = timestampForTouch(touch);
    } else {
      console.warn("Cannot record touch end without a touch start.\n", "Touch End: " + printTouch(touch) + "\n", "Touch Bank: " + printTouchBank(touchHistory));
    }
  }
  function printTouch(touch) {
    return JSON.stringify({
      identifier: touch.identifier,
      pageX: touch.pageX,
      pageY: touch.pageY,
      timestamp: timestampForTouch(touch)
    });
  }
  function printTouchBank(touchHistory) {
    var touchBank = touchHistory.touchBank;
    var printed = JSON.stringify(touchBank.slice(0, MAX_TOUCH_BANK));
    if (touchBank.length > MAX_TOUCH_BANK) {
      printed += " (original size: " + touchBank.length + ")";
    }
    return printed;
  }
  var ResponderTouchHistoryStore = class {
    constructor() {
      this._touchHistory = {
        touchBank: [],
        //Array<TouchRecord>
        numberActiveTouches: 0,
        // If there is only one active touch, we remember its location. This prevents
        // us having to loop through all of the touches all the time in the most
        // common case.
        indexOfSingleActiveTouch: -1,
        mostRecentTimeStamp: 0
      };
    }
    recordTouchTrack(topLevelType, nativeEvent) {
      var touchHistory = this._touchHistory;
      if (isMoveish(topLevelType)) {
        nativeEvent.changedTouches.forEach((touch) => recordTouchMove(touch, touchHistory));
      } else if (isStartish(topLevelType)) {
        nativeEvent.changedTouches.forEach((touch) => recordTouchStart(touch, touchHistory));
        touchHistory.numberActiveTouches = nativeEvent.touches.length;
        if (touchHistory.numberActiveTouches === 1) {
          touchHistory.indexOfSingleActiveTouch = nativeEvent.touches[0].identifier;
        }
      } else if (isEndish(topLevelType)) {
        nativeEvent.changedTouches.forEach((touch) => recordTouchEnd(touch, touchHistory));
        touchHistory.numberActiveTouches = nativeEvent.touches.length;
        if (touchHistory.numberActiveTouches === 1) {
          var touchBank = touchHistory.touchBank;
          for (var i = 0; i < touchBank.length; i++) {
            var touchTrackToCheck = touchBank[i];
            if (touchTrackToCheck != null && touchTrackToCheck.touchActive) {
              touchHistory.indexOfSingleActiveTouch = i;
              break;
            }
          }
          if (__DEV__) {
            var activeRecord = touchBank[touchHistory.indexOfSingleActiveTouch];
            if (!(activeRecord != null && activeRecord.touchActive)) {
              console.error("Cannot find single active touch.");
            }
          }
        }
      }
    }
    get touchHistory() {
      return this._touchHistory;
    }
  };

  // node_modules/react-native-web/dist/modules/useResponderEvents/ResponderSystem.js
  var emptyObject7 = {};
  var startRegistration = ["onStartShouldSetResponderCapture", "onStartShouldSetResponder", {
    bubbles: true
  }];
  var moveRegistration = ["onMoveShouldSetResponderCapture", "onMoveShouldSetResponder", {
    bubbles: true
  }];
  var scrollRegistration = ["onScrollShouldSetResponderCapture", "onScrollShouldSetResponder", {
    bubbles: false
  }];
  var shouldSetResponderEvents = {
    touchstart: startRegistration,
    mousedown: startRegistration,
    touchmove: moveRegistration,
    mousemove: moveRegistration,
    scroll: scrollRegistration
  };
  var emptyResponder = {
    id: null,
    idPath: null,
    node: null
  };
  var responderListenersMap = /* @__PURE__ */ new Map();
  var isEmulatingMouseEvents = false;
  var trackedTouchCount = 0;
  var currentResponder = {
    id: null,
    node: null,
    idPath: null
  };
  var responderTouchHistoryStore = new ResponderTouchHistoryStore();
  function changeCurrentResponder(responder) {
    currentResponder = responder;
  }
  function getResponderConfig(id) {
    var config = responderListenersMap.get(id);
    return config != null ? config : emptyObject7;
  }
  function eventListener(domEvent) {
    var eventType = domEvent.type;
    var eventTarget = domEvent.target;
    if (eventType === "touchstart") {
      isEmulatingMouseEvents = true;
    }
    if (eventType === "touchmove" || trackedTouchCount > 1) {
      isEmulatingMouseEvents = false;
    }
    if (
      // Ignore browser emulated mouse events
      eventType === "mousedown" && isEmulatingMouseEvents || eventType === "mousemove" && isEmulatingMouseEvents || // Ignore mousemove if a mousedown didn't occur first
      eventType === "mousemove" && trackedTouchCount < 1
    ) {
      return;
    }
    if (isEmulatingMouseEvents && eventType === "mouseup") {
      if (trackedTouchCount === 0) {
        isEmulatingMouseEvents = false;
      }
      return;
    }
    var isStartEvent = isStartish(eventType) && isPrimaryPointerDown(domEvent);
    var isMoveEvent = isMoveish(eventType);
    var isEndEvent = isEndish(eventType);
    var isScrollEvent = isScroll(eventType);
    var isSelectionChangeEvent = isSelectionChange(eventType);
    var responderEvent = createResponderEvent(domEvent, responderTouchHistoryStore);
    if (isStartEvent || isMoveEvent || isEndEvent) {
      if (domEvent.touches) {
        trackedTouchCount = domEvent.touches.length;
      } else {
        if (isStartEvent) {
          trackedTouchCount = 1;
        } else if (isEndEvent) {
          trackedTouchCount = 0;
        }
      }
      responderTouchHistoryStore.recordTouchTrack(eventType, responderEvent.nativeEvent);
    }
    var eventPaths = getResponderPaths(domEvent);
    var wasNegotiated = false;
    var wantsResponder;
    if (isStartEvent || isMoveEvent || isScrollEvent && trackedTouchCount > 0) {
      var currentResponderIdPath = currentResponder.idPath;
      var eventIdPath = eventPaths.idPath;
      if (currentResponderIdPath != null && eventIdPath != null) {
        var lowestCommonAncestor = getLowestCommonAncestor(currentResponderIdPath, eventIdPath);
        if (lowestCommonAncestor != null) {
          var indexOfLowestCommonAncestor = eventIdPath.indexOf(lowestCommonAncestor);
          var index = indexOfLowestCommonAncestor + (lowestCommonAncestor === currentResponder.id ? 1 : 0);
          eventPaths = {
            idPath: eventIdPath.slice(index),
            nodePath: eventPaths.nodePath.slice(index)
          };
        } else {
          eventPaths = null;
        }
      }
      if (eventPaths != null) {
        wantsResponder = findWantsResponder(eventPaths, domEvent, responderEvent);
        if (wantsResponder != null) {
          attemptTransfer(responderEvent, wantsResponder);
          wasNegotiated = true;
        }
      }
    }
    if (currentResponder.id != null && currentResponder.node != null) {
      var _currentResponder = currentResponder, id = _currentResponder.id, node = _currentResponder.node;
      var _getResponderConfig = getResponderConfig(id), onResponderStart = _getResponderConfig.onResponderStart, onResponderMove = _getResponderConfig.onResponderMove, onResponderEnd = _getResponderConfig.onResponderEnd, onResponderRelease = _getResponderConfig.onResponderRelease, onResponderTerminate = _getResponderConfig.onResponderTerminate, onResponderTerminationRequest = _getResponderConfig.onResponderTerminationRequest;
      responderEvent.bubbles = false;
      responderEvent.cancelable = false;
      responderEvent.currentTarget = node;
      if (isStartEvent) {
        if (onResponderStart != null) {
          responderEvent.dispatchConfig.registrationName = "onResponderStart";
          onResponderStart(responderEvent);
        }
      } else if (isMoveEvent) {
        if (onResponderMove != null) {
          responderEvent.dispatchConfig.registrationName = "onResponderMove";
          onResponderMove(responderEvent);
        }
      } else {
        var isTerminateEvent = isCancelish(eventType) || // native context menu
        eventType === "contextmenu" || // window blur
        eventType === "blur" && eventTarget === window || // responder (or ancestors) blur
        eventType === "blur" && eventTarget.contains(node) && domEvent.relatedTarget !== node || // native scroll without using a pointer
        isScrollEvent && trackedTouchCount === 0 || // native scroll on node that is parent of the responder (allow siblings to scroll)
        isScrollEvent && eventTarget.contains(node) && eventTarget !== node || // native select/selectionchange on node
        isSelectionChangeEvent && hasValidSelection(domEvent);
        var isReleaseEvent = isEndEvent && !isTerminateEvent && !hasTargetTouches(node, domEvent.touches);
        if (isEndEvent) {
          if (onResponderEnd != null) {
            responderEvent.dispatchConfig.registrationName = "onResponderEnd";
            onResponderEnd(responderEvent);
          }
        }
        if (isReleaseEvent) {
          if (onResponderRelease != null) {
            responderEvent.dispatchConfig.registrationName = "onResponderRelease";
            onResponderRelease(responderEvent);
          }
          changeCurrentResponder(emptyResponder);
        }
        if (isTerminateEvent) {
          var shouldTerminate = true;
          if (eventType === "contextmenu" || eventType === "scroll" || eventType === "selectionchange") {
            if (wasNegotiated) {
              shouldTerminate = false;
            } else if (onResponderTerminationRequest != null) {
              responderEvent.dispatchConfig.registrationName = "onResponderTerminationRequest";
              if (onResponderTerminationRequest(responderEvent) === false) {
                shouldTerminate = false;
              }
            }
          }
          if (shouldTerminate) {
            if (onResponderTerminate != null) {
              responderEvent.dispatchConfig.registrationName = "onResponderTerminate";
              onResponderTerminate(responderEvent);
            }
            changeCurrentResponder(emptyResponder);
            isEmulatingMouseEvents = false;
            trackedTouchCount = 0;
          }
        }
      }
    }
  }
  function findWantsResponder(eventPaths, domEvent, responderEvent) {
    var shouldSetCallbacks = shouldSetResponderEvents[domEvent.type];
    if (shouldSetCallbacks != null) {
      var idPath = eventPaths.idPath, nodePath = eventPaths.nodePath;
      var shouldSetCallbackCaptureName = shouldSetCallbacks[0];
      var shouldSetCallbackBubbleName = shouldSetCallbacks[1];
      var bubbles = shouldSetCallbacks[2].bubbles;
      var check = function check2(id2, node2, callbackName) {
        var config = getResponderConfig(id2);
        var shouldSetCallback = config[callbackName];
        if (shouldSetCallback != null) {
          responderEvent.currentTarget = node2;
          if (shouldSetCallback(responderEvent) === true) {
            var prunedIdPath = idPath.slice(idPath.indexOf(id2));
            return {
              id: id2,
              node: node2,
              idPath: prunedIdPath
            };
          }
        }
      };
      for (var i = idPath.length - 1; i >= 0; i--) {
        var id = idPath[i];
        var node = nodePath[i];
        var result = check(id, node, shouldSetCallbackCaptureName);
        if (result != null) {
          return result;
        }
        if (responderEvent.isPropagationStopped() === true) {
          return;
        }
      }
      if (bubbles) {
        for (var _i = 0; _i < idPath.length; _i++) {
          var _id = idPath[_i];
          var _node = nodePath[_i];
          var _result = check(_id, _node, shouldSetCallbackBubbleName);
          if (_result != null) {
            return _result;
          }
          if (responderEvent.isPropagationStopped() === true) {
            return;
          }
        }
      } else {
        var _id2 = idPath[0];
        var _node2 = nodePath[0];
        var target = domEvent.target;
        if (target === _node2) {
          return check(_id2, _node2, shouldSetCallbackBubbleName);
        }
      }
    }
  }
  function attemptTransfer(responderEvent, wantsResponder) {
    var _currentResponder2 = currentResponder, currentId = _currentResponder2.id, currentNode = _currentResponder2.node;
    var id = wantsResponder.id, node = wantsResponder.node;
    var _getResponderConfig2 = getResponderConfig(id), onResponderGrant = _getResponderConfig2.onResponderGrant, onResponderReject = _getResponderConfig2.onResponderReject;
    responderEvent.bubbles = false;
    responderEvent.cancelable = false;
    responderEvent.currentTarget = node;
    if (currentId == null) {
      if (onResponderGrant != null) {
        responderEvent.currentTarget = node;
        responderEvent.dispatchConfig.registrationName = "onResponderGrant";
        onResponderGrant(responderEvent);
      }
      changeCurrentResponder(wantsResponder);
    } else {
      var _getResponderConfig3 = getResponderConfig(currentId), onResponderTerminate = _getResponderConfig3.onResponderTerminate, onResponderTerminationRequest = _getResponderConfig3.onResponderTerminationRequest;
      var allowTransfer = true;
      if (onResponderTerminationRequest != null) {
        responderEvent.currentTarget = currentNode;
        responderEvent.dispatchConfig.registrationName = "onResponderTerminationRequest";
        if (onResponderTerminationRequest(responderEvent) === false) {
          allowTransfer = false;
        }
      }
      if (allowTransfer) {
        if (onResponderTerminate != null) {
          responderEvent.currentTarget = currentNode;
          responderEvent.dispatchConfig.registrationName = "onResponderTerminate";
          onResponderTerminate(responderEvent);
        }
        if (onResponderGrant != null) {
          responderEvent.currentTarget = node;
          responderEvent.dispatchConfig.registrationName = "onResponderGrant";
          onResponderGrant(responderEvent);
        }
        changeCurrentResponder(wantsResponder);
      } else {
        if (onResponderReject != null) {
          responderEvent.currentTarget = node;
          responderEvent.dispatchConfig.registrationName = "onResponderReject";
          onResponderReject(responderEvent);
        }
      }
    }
  }
  var documentEventsCapturePhase = ["blur", "scroll"];
  var documentEventsBubblePhase = [
    // mouse
    "mousedown",
    "mousemove",
    "mouseup",
    "dragstart",
    // touch
    "touchstart",
    "touchmove",
    "touchend",
    "touchcancel",
    // other
    "contextmenu",
    "select",
    "selectionchange"
  ];
  function attachListeners() {
    if (canUseDom_default && window.__reactResponderSystemActive == null) {
      window.addEventListener("blur", eventListener);
      documentEventsBubblePhase.forEach((eventType) => {
        document.addEventListener(eventType, eventListener);
      });
      documentEventsCapturePhase.forEach((eventType) => {
        document.addEventListener(eventType, eventListener, true);
      });
      window.__reactResponderSystemActive = true;
    }
  }
  function addNode(id, node, config) {
    setResponderId(node, id);
    responderListenersMap.set(id, config);
  }
  function removeNode(id) {
    if (currentResponder.id === id) {
      terminateResponder();
    }
    if (responderListenersMap.has(id)) {
      responderListenersMap.delete(id);
    }
  }
  function terminateResponder() {
    var _currentResponder3 = currentResponder, id = _currentResponder3.id, node = _currentResponder3.node;
    if (id != null && node != null) {
      var _getResponderConfig4 = getResponderConfig(id), onResponderTerminate = _getResponderConfig4.onResponderTerminate;
      if (onResponderTerminate != null) {
        var event = createResponderEvent({}, responderTouchHistoryStore);
        event.currentTarget = node;
        onResponderTerminate(event);
      }
      changeCurrentResponder(emptyResponder);
    }
    isEmulatingMouseEvents = false;
    trackedTouchCount = 0;
  }
  function getResponderNode() {
    return currentResponder.node;
  }

  // node_modules/react-native-web/dist/modules/useResponderEvents/index.js
  var emptyObject8 = {};
  var idCounter = 0;
  function useStable2(getInitialValue) {
    var ref = React6.useRef(null);
    if (ref.current == null) {
      ref.current = getInitialValue();
    }
    return ref.current;
  }
  function useResponderEvents(hostRef, config) {
    if (config === void 0) {
      config = emptyObject8;
    }
    var id = useStable2(() => idCounter++);
    var isAttachedRef = React6.useRef(false);
    React6.useEffect(() => {
      attachListeners();
      return () => {
        removeNode(id);
      };
    }, [id]);
    React6.useEffect(() => {
      var _config = config, onMoveShouldSetResponder = _config.onMoveShouldSetResponder, onMoveShouldSetResponderCapture = _config.onMoveShouldSetResponderCapture, onScrollShouldSetResponder = _config.onScrollShouldSetResponder, onScrollShouldSetResponderCapture = _config.onScrollShouldSetResponderCapture, onSelectionChangeShouldSetResponder = _config.onSelectionChangeShouldSetResponder, onSelectionChangeShouldSetResponderCapture = _config.onSelectionChangeShouldSetResponderCapture, onStartShouldSetResponder = _config.onStartShouldSetResponder, onStartShouldSetResponderCapture = _config.onStartShouldSetResponderCapture;
      var requiresResponderSystem = onMoveShouldSetResponder != null || onMoveShouldSetResponderCapture != null || onScrollShouldSetResponder != null || onScrollShouldSetResponderCapture != null || onSelectionChangeShouldSetResponder != null || onSelectionChangeShouldSetResponderCapture != null || onStartShouldSetResponder != null || onStartShouldSetResponderCapture != null;
      var node = hostRef.current;
      if (requiresResponderSystem) {
        addNode(id, node, config);
        isAttachedRef.current = true;
      } else if (isAttachedRef.current) {
        removeNode(id);
        isAttachedRef.current = false;
      }
    }, [config, hostRef, id]);
    React6.useDebugValue({
      isResponder: hostRef.current === getResponderNode()
    });
    React6.useDebugValue(config);
  }

  // node_modules/react-native-web/dist/exports/Text/TextAncestorContext.js
  var import_react4 = __toESM(require_react());
  var TextAncestorContext = /* @__PURE__ */ (0, import_react4.createContext)(false);
  var TextAncestorContext_default = TextAncestorContext;

  // node_modules/react-native-web/dist/exports/View/index.js
  var _excluded4 = ["hrefAttrs", "onLayout", "onMoveShouldSetResponder", "onMoveShouldSetResponderCapture", "onResponderEnd", "onResponderGrant", "onResponderMove", "onResponderReject", "onResponderRelease", "onResponderStart", "onResponderTerminate", "onResponderTerminationRequest", "onScrollShouldSetResponder", "onScrollShouldSetResponderCapture", "onSelectionChangeShouldSetResponder", "onSelectionChangeShouldSetResponderCapture", "onStartShouldSetResponder", "onStartShouldSetResponderCapture"];
  var forwardPropsList = Object.assign({}, defaultProps, accessibilityProps, clickProps, focusProps, keyboardProps, mouseProps, touchProps, styleProps, {
    href: true,
    lang: true,
    onScroll: true,
    onWheel: true,
    pointerEvents: true
  });
  var pickProps = (props) => pick(props, forwardPropsList);
  var View = /* @__PURE__ */ React7.forwardRef((props, forwardedRef) => {
    var hrefAttrs = props.hrefAttrs, onLayout = props.onLayout, onMoveShouldSetResponder = props.onMoveShouldSetResponder, onMoveShouldSetResponderCapture = props.onMoveShouldSetResponderCapture, onResponderEnd = props.onResponderEnd, onResponderGrant = props.onResponderGrant, onResponderMove = props.onResponderMove, onResponderReject = props.onResponderReject, onResponderRelease = props.onResponderRelease, onResponderStart = props.onResponderStart, onResponderTerminate = props.onResponderTerminate, onResponderTerminationRequest = props.onResponderTerminationRequest, onScrollShouldSetResponder = props.onScrollShouldSetResponder, onScrollShouldSetResponderCapture = props.onScrollShouldSetResponderCapture, onSelectionChangeShouldSetResponder = props.onSelectionChangeShouldSetResponder, onSelectionChangeShouldSetResponderCapture = props.onSelectionChangeShouldSetResponderCapture, onStartShouldSetResponder = props.onStartShouldSetResponder, onStartShouldSetResponderCapture = props.onStartShouldSetResponderCapture, rest = _objectWithoutPropertiesLoose(props, _excluded4);
    if (false) {
      React7.Children.toArray(props.children).forEach((item) => {
        if (typeof item === "string") {
          console.error("Unexpected text node: " + item + ". A text node cannot be a child of a <View>.");
        }
      });
    }
    var hasTextAncestor = React7.useContext(TextAncestorContext_default);
    var hostRef = React7.useRef(null);
    var _useLocaleContext = useLocaleContext(), contextDirection = _useLocaleContext.direction;
    useElementLayout(hostRef, onLayout);
    useResponderEvents(hostRef, {
      onMoveShouldSetResponder,
      onMoveShouldSetResponderCapture,
      onResponderEnd,
      onResponderGrant,
      onResponderMove,
      onResponderReject,
      onResponderRelease,
      onResponderStart,
      onResponderTerminate,
      onResponderTerminationRequest,
      onScrollShouldSetResponder,
      onScrollShouldSetResponderCapture,
      onSelectionChangeShouldSetResponder,
      onSelectionChangeShouldSetResponderCapture,
      onStartShouldSetResponder,
      onStartShouldSetResponderCapture
    });
    var component = "div";
    var langDirection = props.lang != null ? getLocaleDirection(props.lang) : null;
    var componentDirection = props.dir || langDirection;
    var writingDirection = componentDirection || contextDirection;
    var supportedProps = pickProps(rest);
    supportedProps.dir = componentDirection;
    supportedProps.style = [styles.view$raw, hasTextAncestor && styles.inline, props.style];
    if (props.href != null) {
      component = "a";
      if (hrefAttrs != null) {
        var download = hrefAttrs.download, rel = hrefAttrs.rel, target = hrefAttrs.target;
        if (download != null) {
          supportedProps.download = download;
        }
        if (rel != null) {
          supportedProps.rel = rel;
        }
        if (typeof target === "string") {
          supportedProps.target = target.charAt(0) !== "_" ? "_" + target : target;
        }
      }
    }
    var platformMethodsRef = usePlatformMethods(supportedProps);
    var setRef = useMergeRefs(hostRef, platformMethodsRef, forwardedRef);
    supportedProps.ref = setRef;
    return createElement_default(component, supportedProps, {
      writingDirection
    });
  });
  View.displayName = "View";
  var styles = StyleSheet_default.create({
    view$raw: {
      alignContent: "flex-start",
      alignItems: "stretch",
      backgroundColor: "transparent",
      border: "0 solid black",
      boxSizing: "border-box",
      display: "flex",
      flexBasis: "auto",
      flexDirection: "column",
      flexShrink: 0,
      listStyle: "none",
      margin: 0,
      minHeight: 0,
      minWidth: 0,
      padding: 0,
      position: "relative",
      textDecoration: "none",
      zIndex: 0
    },
    inline: {
      display: "inline-flex"
    }
  });
  var View_default = View;

  // node_modules/react-native-web/dist/vendor/react-native/deepDiffer/index.js
  var deepDiffer = function deepDiffer2(one, two, maxDepth) {
    if (maxDepth === void 0) {
      maxDepth = -1;
    }
    if (maxDepth === 0) {
      return true;
    }
    if (one === two) {
      return false;
    }
    if (typeof one === "function" && typeof two === "function") {
      return false;
    }
    if (typeof one !== "object" || one === null) {
      return one !== two;
    }
    if (typeof two !== "object" || two === null) {
      return true;
    }
    if (one.constructor !== two.constructor) {
      return true;
    }
    if (Array.isArray(one)) {
      var len = one.length;
      if (two.length !== len) {
        return true;
      }
      for (var ii = 0; ii < len; ii++) {
        if (deepDiffer2(one[ii], two[ii], maxDepth - 1)) {
          return true;
        }
      }
    } else {
      for (var key in one) {
        if (deepDiffer2(one[key], two[key], maxDepth - 1)) {
          return true;
        }
      }
      for (var twoKey in two) {
        if (one[twoKey] === void 0 && two[twoKey] !== void 0) {
          return true;
        }
      }
    }
    return false;
  };
  var deepDiffer_default = deepDiffer;

  // node_modules/react-native-web/dist/vendor/react-native/FlatList/index.js
  var import_invariant11 = __toESM(require_invariant());
  var React15 = __toESM(require_react());

  // node_modules/react-native-web/node_modules/@babel/runtime/helpers/esm/arrayLikeToArray.js
  function _arrayLikeToArray(r, a) {
    (null == a || a > r.length) && (a = r.length);
    for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
    return n;
  }

  // node_modules/react-native-web/node_modules/@babel/runtime/helpers/esm/unsupportedIterableToArray.js
  function _unsupportedIterableToArray(r, a) {
    if (r) {
      if ("string" == typeof r) return _arrayLikeToArray(r, a);
      var t = {}.toString.call(r).slice(8, -1);
      return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
    }
  }

  // node_modules/react-native-web/node_modules/@babel/runtime/helpers/esm/createForOfIteratorHelperLoose.js
  function _createForOfIteratorHelperLoose(r, e) {
    var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (t) return (t = t.call(r)).next.bind(t);
    if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) {
      t && (r = t);
      var o = 0;
      return function() {
        return o >= r.length ? {
          done: true
        } : {
          done: false,
          value: r[o++]
        };
      };
    }
    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  // node_modules/react-native-web/dist/exports/RefreshControl/index.js
  var import_react5 = __toESM(require_react());
  var _excluded5 = ["colors", "enabled", "onRefresh", "progressBackgroundColor", "progressViewOffset", "refreshing", "size", "tintColor", "title", "titleColor"];
  function RefreshControl(props) {
    var colors = props.colors, enabled = props.enabled, onRefresh = props.onRefresh, progressBackgroundColor = props.progressBackgroundColor, progressViewOffset = props.progressViewOffset, refreshing = props.refreshing, size = props.size, tintColor = props.tintColor, title = props.title, titleColor = props.titleColor, rest = _objectWithoutPropertiesLoose(props, _excluded5);
    return /* @__PURE__ */ import_react5.default.createElement(View_default, rest);
  }
  var RefreshControl_default = RefreshControl;

  // node_modules/react-native-web/dist/exports/Dimensions/index.js
  var import_invariant = __toESM(require_invariant());
  var dimensions = {
    window: {
      fontScale: 1,
      height: 0,
      scale: 1,
      width: 0
    },
    screen: {
      fontScale: 1,
      height: 0,
      scale: 1,
      width: 0
    }
  };
  var listeners = {};
  var shouldInit = canUseDom_default;
  function update() {
    if (!canUseDom_default) {
      return;
    }
    var win = window;
    var height;
    var width;
    if (win.visualViewport) {
      var visualViewport = win.visualViewport;
      height = Math.round(visualViewport.height * visualViewport.scale);
      width = Math.round(visualViewport.width * visualViewport.scale);
    } else {
      var docEl = win.document.documentElement;
      height = docEl.clientHeight;
      width = docEl.clientWidth;
    }
    dimensions.window = {
      fontScale: 1,
      height,
      scale: win.devicePixelRatio || 1,
      width
    };
    dimensions.screen = {
      fontScale: 1,
      height: win.screen.height,
      scale: win.devicePixelRatio || 1,
      width: win.screen.width
    };
  }
  function handleResize() {
    update();
    if (Array.isArray(listeners["change"])) {
      listeners["change"].forEach((handler) => handler(dimensions));
    }
  }
  var Dimensions = class {
    static get(dimension) {
      if (shouldInit) {
        shouldInit = false;
        update();
      }
      (0, import_invariant.default)(dimensions[dimension], "No dimension set for key " + dimension);
      return dimensions[dimension];
    }
    static set(initialDimensions) {
      if (initialDimensions) {
        if (canUseDom_default) {
          (0, import_invariant.default)(false, "Dimensions cannot be set in the browser");
        } else {
          if (initialDimensions.screen != null) {
            dimensions.screen = initialDimensions.screen;
          }
          if (initialDimensions.window != null) {
            dimensions.window = initialDimensions.window;
          }
        }
      }
    }
    static addEventListener(type, handler) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(handler);
      return {
        remove: () => {
          this.removeEventListener(type, handler);
        }
      };
    }
    static removeEventListener(type, handler) {
      if (Array.isArray(listeners[type])) {
        listeners[type] = listeners[type].filter((_handler) => _handler !== handler);
      }
    }
  };
  if (canUseDom_default) {
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize, false);
    } else {
      window.addEventListener("resize", handleResize, false);
    }
  }

  // node_modules/react-native-web/dist/modules/TextInputState/index.js
  var TextInputState = {
    /**
     * Internal state
     */
    _currentlyFocusedNode: null,
    /**
     * Returns the ID of the currently focused text field, if one exists
     * If no text field is focused it returns null
     */
    currentlyFocusedField() {
      if (document.activeElement !== this._currentlyFocusedNode) {
        this._currentlyFocusedNode = null;
      }
      return this._currentlyFocusedNode;
    },
    /**
     * @param {Object} TextInputID id of the text field to focus
     * Focuses the specified text field
     * noop if the text field was already focused
     */
    focusTextInput(textFieldNode) {
      if (textFieldNode !== null) {
        this._currentlyFocusedNode = textFieldNode;
        if (document.activeElement !== textFieldNode) {
          UIManager_default.focus(textFieldNode);
        }
      }
    },
    /**
     * @param {Object} textFieldNode id of the text field to focus
     * Unfocuses the specified text field
     * noop if it wasn't focused
     */
    blurTextInput(textFieldNode) {
      if (textFieldNode !== null) {
        this._currentlyFocusedNode = null;
        if (document.activeElement === textFieldNode) {
          UIManager_default.blur(textFieldNode);
        }
      }
    }
  };
  var TextInputState_default = TextInputState;

  // node_modules/react-native-web/dist/modules/dismissKeyboard/index.js
  var dismissKeyboard = () => {
    TextInputState_default.blurTextInput(TextInputState_default.currentlyFocusedField());
  };
  var dismissKeyboard_default = dismissKeyboard;

  // node_modules/react-native-web/dist/exports/ScrollView/index.js
  var import_invariant2 = __toESM(require_invariant());

  // node_modules/react-native-web/dist/exports/ScrollView/ScrollViewBase.js
  var React9 = __toESM(require_react());
  var _excluded6 = ["onScroll", "onTouchMove", "onWheel", "scrollEnabled", "scrollEventThrottle", "showsHorizontalScrollIndicator", "showsVerticalScrollIndicator", "style"];
  function normalizeScrollEvent(e) {
    return {
      nativeEvent: {
        contentOffset: {
          get x() {
            return e.target.scrollLeft;
          },
          get y() {
            return e.target.scrollTop;
          }
        },
        contentSize: {
          get height() {
            return e.target.scrollHeight;
          },
          get width() {
            return e.target.scrollWidth;
          }
        },
        layoutMeasurement: {
          get height() {
            return e.target.offsetHeight;
          },
          get width() {
            return e.target.offsetWidth;
          }
        }
      },
      timeStamp: Date.now()
    };
  }
  function shouldEmitScrollEvent(lastTick, eventThrottle) {
    var timeSinceLastTick = Date.now() - lastTick;
    return eventThrottle > 0 && timeSinceLastTick >= eventThrottle;
  }
  var ScrollViewBase = /* @__PURE__ */ React9.forwardRef((props, forwardedRef) => {
    var onScroll = props.onScroll, onTouchMove = props.onTouchMove, onWheel = props.onWheel, _props$scrollEnabled = props.scrollEnabled, scrollEnabled = _props$scrollEnabled === void 0 ? true : _props$scrollEnabled, _props$scrollEventThr = props.scrollEventThrottle, scrollEventThrottle = _props$scrollEventThr === void 0 ? 0 : _props$scrollEventThr, showsHorizontalScrollIndicator = props.showsHorizontalScrollIndicator, showsVerticalScrollIndicator = props.showsVerticalScrollIndicator, style = props.style, rest = _objectWithoutPropertiesLoose(props, _excluded6);
    var scrollState = React9.useRef({
      isScrolling: false,
      scrollLastTick: 0
    });
    var scrollTimeout = React9.useRef(null);
    var scrollRef = React9.useRef(null);
    function createPreventableScrollHandler(handler) {
      return (e) => {
        if (scrollEnabled) {
          if (handler) {
            handler(e);
          }
        }
      };
    }
    function handleScroll(e) {
      e.stopPropagation();
      if (e.target === scrollRef.current) {
        e.persist();
        if (scrollTimeout.current != null) {
          clearTimeout(scrollTimeout.current);
        }
        scrollTimeout.current = setTimeout(() => {
          handleScrollEnd(e);
        }, 100);
        if (scrollState.current.isScrolling) {
          if (shouldEmitScrollEvent(scrollState.current.scrollLastTick, scrollEventThrottle)) {
            handleScrollTick(e);
          }
        } else {
          handleScrollStart(e);
        }
      }
    }
    function handleScrollStart(e) {
      scrollState.current.isScrolling = true;
      handleScrollTick(e);
    }
    function handleScrollTick(e) {
      scrollState.current.scrollLastTick = Date.now();
      if (onScroll) {
        onScroll(normalizeScrollEvent(e));
      }
    }
    function handleScrollEnd(e) {
      scrollState.current.isScrolling = false;
      if (onScroll) {
        onScroll(normalizeScrollEvent(e));
      }
    }
    var hideScrollbar = showsHorizontalScrollIndicator === false || showsVerticalScrollIndicator === false;
    return /* @__PURE__ */ React9.createElement(View_default, _extends({}, rest, {
      onScroll: handleScroll,
      onTouchMove: createPreventableScrollHandler(onTouchMove),
      onWheel: createPreventableScrollHandler(onWheel),
      ref: useMergeRefs(scrollRef, forwardedRef),
      style: [style, !scrollEnabled && styles2.scrollDisabled, hideScrollbar && styles2.hideScrollbar]
    }));
  });
  var styles2 = StyleSheet_default.create({
    scrollDisabled: {
      overflowX: "hidden",
      overflowY: "hidden",
      touchAction: "none"
    },
    hideScrollbar: {
      scrollbarWidth: "none"
    }
  });
  var ScrollViewBase_default = ScrollViewBase;

  // node_modules/react-native-web/dist/exports/ScrollView/index.js
  var import_react6 = __toESM(require_react());
  var import_warning = __toESM(require_warning());
  var _excluded7 = ["contentContainerStyle", "horizontal", "onContentSizeChange", "refreshControl", "stickyHeaderIndices", "pagingEnabled", "forwardedRef", "keyboardDismissMode", "onScroll", "centerContent"];
  var emptyObject9 = {};
  var IS_ANIMATING_TOUCH_START_THRESHOLD_MS = 16;
  var ScrollView = class extends import_react6.default.Component {
    constructor() {
      super(...arguments);
      this._scrollNodeRef = null;
      this._innerViewRef = null;
      this.isTouching = false;
      this.lastMomentumScrollBeginTime = 0;
      this.lastMomentumScrollEndTime = 0;
      this.observedScrollSinceBecomingResponder = false;
      this.becameResponderWhileAnimating = false;
      this.scrollResponderHandleScrollShouldSetResponder = () => {
        return this.isTouching;
      };
      this.scrollResponderHandleStartShouldSetResponderCapture = (e) => {
        return this.scrollResponderIsAnimating();
      };
      this.scrollResponderHandleTerminationRequest = () => {
        return !this.observedScrollSinceBecomingResponder;
      };
      this.scrollResponderHandleTouchEnd = (e) => {
        var nativeEvent = e.nativeEvent;
        this.isTouching = nativeEvent.touches.length !== 0;
        this.props.onTouchEnd && this.props.onTouchEnd(e);
      };
      this.scrollResponderHandleResponderRelease = (e) => {
        this.props.onResponderRelease && this.props.onResponderRelease(e);
        var currentlyFocusedTextInput = TextInputState_default.currentlyFocusedField();
        if (!this.props.keyboardShouldPersistTaps && currentlyFocusedTextInput != null && e.target !== currentlyFocusedTextInput && !this.observedScrollSinceBecomingResponder && !this.becameResponderWhileAnimating) {
          this.props.onScrollResponderKeyboardDismissed && this.props.onScrollResponderKeyboardDismissed(e);
          TextInputState_default.blurTextInput(currentlyFocusedTextInput);
        }
      };
      this.scrollResponderHandleScroll = (e) => {
        this.observedScrollSinceBecomingResponder = true;
        this.props.onScroll && this.props.onScroll(e);
      };
      this.scrollResponderHandleResponderGrant = (e) => {
        this.observedScrollSinceBecomingResponder = false;
        this.props.onResponderGrant && this.props.onResponderGrant(e);
        this.becameResponderWhileAnimating = this.scrollResponderIsAnimating();
      };
      this.scrollResponderHandleScrollBeginDrag = (e) => {
        this.props.onScrollBeginDrag && this.props.onScrollBeginDrag(e);
      };
      this.scrollResponderHandleScrollEndDrag = (e) => {
        this.props.onScrollEndDrag && this.props.onScrollEndDrag(e);
      };
      this.scrollResponderHandleMomentumScrollBegin = (e) => {
        this.lastMomentumScrollBeginTime = Date.now();
        this.props.onMomentumScrollBegin && this.props.onMomentumScrollBegin(e);
      };
      this.scrollResponderHandleMomentumScrollEnd = (e) => {
        this.lastMomentumScrollEndTime = Date.now();
        this.props.onMomentumScrollEnd && this.props.onMomentumScrollEnd(e);
      };
      this.scrollResponderHandleTouchStart = (e) => {
        this.isTouching = true;
        this.props.onTouchStart && this.props.onTouchStart(e);
      };
      this.scrollResponderHandleTouchMove = (e) => {
        this.props.onTouchMove && this.props.onTouchMove(e);
      };
      this.scrollResponderIsAnimating = () => {
        var now = Date.now();
        var timeSinceLastMomentumScrollEnd = now - this.lastMomentumScrollEndTime;
        var isAnimating = timeSinceLastMomentumScrollEnd < IS_ANIMATING_TOUCH_START_THRESHOLD_MS || this.lastMomentumScrollEndTime < this.lastMomentumScrollBeginTime;
        return isAnimating;
      };
      this.scrollResponderScrollTo = (x, y, animated) => {
        if (typeof x === "number") {
          console.warn("`scrollResponderScrollTo(x, y, animated)` is deprecated. Use `scrollResponderScrollTo({x: 5, y: 5, animated: true})` instead.");
        } else {
          var _ref = x || emptyObject9;
          x = _ref.x;
          y = _ref.y;
          animated = _ref.animated;
        }
        var node = this.getScrollableNode();
        var left2 = x || 0;
        var top = y || 0;
        if (node != null) {
          if (typeof node.scroll === "function") {
            node.scroll({
              top,
              left: left2,
              behavior: !animated ? "auto" : "smooth"
            });
          } else {
            node.scrollLeft = left2;
            node.scrollTop = top;
          }
        }
      };
      this.scrollResponderZoomTo = (rect, animated) => {
        if (Platform_default.OS !== "ios") {
          (0, import_invariant2.default)("zoomToRect is not implemented");
        }
      };
      this.scrollResponderScrollNativeHandleToKeyboard = (nodeHandle, additionalOffset, preventNegativeScrollOffset) => {
        this.additionalScrollOffset = additionalOffset || 0;
        this.preventNegativeScrollOffset = !!preventNegativeScrollOffset;
        UIManager_default.measureLayout(nodeHandle, this.getInnerViewNode(), this.scrollResponderTextInputFocusError, this.scrollResponderInputMeasureAndScrollToKeyboard);
      };
      this.scrollResponderInputMeasureAndScrollToKeyboard = (left2, top, width, height) => {
        var keyboardScreenY = Dimensions.get("window").height;
        if (this.keyboardWillOpenTo) {
          keyboardScreenY = this.keyboardWillOpenTo.endCoordinates.screenY;
        }
        var scrollOffsetY = top - keyboardScreenY + height + this.additionalScrollOffset;
        if (this.preventNegativeScrollOffset) {
          scrollOffsetY = Math.max(0, scrollOffsetY);
        }
        this.scrollResponderScrollTo({
          x: 0,
          y: scrollOffsetY,
          animated: true
        });
        this.additionalOffset = 0;
        this.preventNegativeScrollOffset = false;
      };
      this.scrollResponderKeyboardWillShow = (e) => {
        this.keyboardWillOpenTo = e;
        this.props.onKeyboardWillShow && this.props.onKeyboardWillShow(e);
      };
      this.scrollResponderKeyboardWillHide = (e) => {
        this.keyboardWillOpenTo = null;
        this.props.onKeyboardWillHide && this.props.onKeyboardWillHide(e);
      };
      this.scrollResponderKeyboardDidShow = (e) => {
        if (e) {
          this.keyboardWillOpenTo = e;
        }
        this.props.onKeyboardDidShow && this.props.onKeyboardDidShow(e);
      };
      this.scrollResponderKeyboardDidHide = (e) => {
        this.keyboardWillOpenTo = null;
        this.props.onKeyboardDidHide && this.props.onKeyboardDidHide(e);
      };
      this.flashScrollIndicators = () => {
        this.scrollResponderFlashScrollIndicators();
      };
      this.getScrollResponder = () => {
        return this;
      };
      this.getScrollableNode = () => {
        return this._scrollNodeRef;
      };
      this.getInnerViewRef = () => {
        return this._innerViewRef;
      };
      this.getInnerViewNode = () => {
        return this._innerViewRef;
      };
      this.getNativeScrollRef = () => {
        return this._scrollNodeRef;
      };
      this.scrollTo = (y, x, animated) => {
        if (typeof y === "number") {
          console.warn("`scrollTo(y, x, animated)` is deprecated. Use `scrollTo({x: 5, y: 5, animated: true})` instead.");
        } else {
          var _ref2 = y || emptyObject9;
          x = _ref2.x;
          y = _ref2.y;
          animated = _ref2.animated;
        }
        this.scrollResponderScrollTo({
          x: x || 0,
          y: y || 0,
          animated: animated !== false
        });
      };
      this.scrollToEnd = (options) => {
        var animated = (options && options.animated) !== false;
        var horizontal = this.props.horizontal;
        var scrollResponderNode = this.getScrollableNode();
        var x = horizontal ? scrollResponderNode.scrollWidth : 0;
        var y = horizontal ? 0 : scrollResponderNode.scrollHeight;
        this.scrollResponderScrollTo({
          x,
          y,
          animated
        });
      };
      this._handleContentOnLayout = (e) => {
        var _e$nativeEvent$layout = e.nativeEvent.layout, width = _e$nativeEvent$layout.width, height = _e$nativeEvent$layout.height;
        this.props.onContentSizeChange(width, height);
      };
      this._handleScroll = (e) => {
        if (false) {
          if (this.props.onScroll && this.props.scrollEventThrottle == null) {
            console.log("You specified `onScroll` on a <ScrollView> but not `scrollEventThrottle`. You will only receive one event. Using `16` you get all the events but be aware that it may cause frame drops, use a bigger number if you don't need as much precision.");
          }
        }
        if (this.props.keyboardDismissMode === "on-drag") {
          dismissKeyboard_default();
        }
        this.scrollResponderHandleScroll(e);
      };
      this._setInnerViewRef = (node) => {
        this._innerViewRef = node;
      };
      this._setScrollNodeRef = (node) => {
        this._scrollNodeRef = node;
        if (node != null) {
          node.getScrollResponder = this.getScrollResponder;
          node.getInnerViewNode = this.getInnerViewNode;
          node.getInnerViewRef = this.getInnerViewRef;
          node.getNativeScrollRef = this.getNativeScrollRef;
          node.getScrollableNode = this.getScrollableNode;
          node.scrollTo = this.scrollTo;
          node.scrollToEnd = this.scrollToEnd;
          node.flashScrollIndicators = this.flashScrollIndicators;
          node.scrollResponderZoomTo = this.scrollResponderZoomTo;
          node.scrollResponderScrollNativeHandleToKeyboard = this.scrollResponderScrollNativeHandleToKeyboard;
        }
        var ref = mergeRefs(this.props.forwardedRef);
        ref(node);
      };
    }
    /**
     * ------------------------------------------------------
     * START SCROLLRESPONDER
     * ------------------------------------------------------
     */
    // Reset to false every time becomes responder. This is used to:
    // - Determine if the scroll view has been scrolled and therefore should
    // refuse to give up its responder lock.
    // - Determine if releasing should dismiss the keyboard when we are in
    // tap-to-dismiss mode (!this.props.keyboardShouldPersistTaps).
    /**
     * Invoke this from an `onScroll` event.
     */
    /**
     * Merely touch starting is not sufficient for a scroll view to become the
     * responder. Being the "responder" means that the very next touch move/end
     * event will result in an action/movement.
     *
     * Invoke this from an `onStartShouldSetResponder` event.
     *
     * `onStartShouldSetResponder` is used when the next move/end will trigger
     * some UI movement/action, but when you want to yield priority to views
     * nested inside of the view.
     *
     * There may be some cases where scroll views actually should return `true`
     * from `onStartShouldSetResponder`: Any time we are detecting a standard tap
     * that gives priority to nested views.
     *
     * - If a single tap on the scroll view triggers an action such as
     *   recentering a map style view yet wants to give priority to interaction
     *   views inside (such as dropped pins or labels), then we would return true
     *   from this method when there is a single touch.
     *
     * - Similar to the previous case, if a two finger "tap" should trigger a
     *   zoom, we would check the `touches` count, and if `>= 2`, we would return
     *   true.
     *
     */
    scrollResponderHandleStartShouldSetResponder() {
      return false;
    }
    /**
     * There are times when the scroll view wants to become the responder
     * (meaning respond to the next immediate `touchStart/touchEnd`), in a way
     * that *doesn't* give priority to nested views (hence the capture phase):
     *
     * - Currently animating.
     * - Tapping anywhere that is not the focused input, while the keyboard is
     *   up (which should dismiss the keyboard).
     *
     * Invoke this from an `onStartShouldSetResponderCapture` event.
     */
    /**
     * Invoke this from an `onResponderReject` event.
     *
     * Some other element is not yielding its role as responder. Normally, we'd
     * just disable the `UIScrollView`, but a touch has already began on it, the
     * `UIScrollView` will not accept being disabled after that. The easiest
     * solution for now is to accept the limitation of disallowing this
     * altogether. To improve this, find a way to disable the `UIScrollView` after
     * a touch has already started.
     */
    scrollResponderHandleResponderReject() {
      (0, import_warning.default)(false, "ScrollView doesn't take rejection well - scrolls anyway");
    }
    /**
     * We will allow the scroll view to give up its lock iff it acquired the lock
     * during an animation. This is a very useful default that happens to satisfy
     * many common user experiences.
     *
     * - Stop a scroll on the left edge, then turn that into an outer view's
     *   backswipe.
     * - Stop a scroll mid-bounce at the top, continue pulling to have the outer
     *   view dismiss.
     * - However, without catching the scroll view mid-bounce (while it is
     *   motionless), if you drag far enough for the scroll view to become
     *   responder (and therefore drag the scroll view a bit), any backswipe
     *   navigation of a swipe gesture higher in the view hierarchy, should be
     *   rejected.
     */
    /**
     * Invoke this from an `onTouchEnd` event.
     *
     * @param {SyntheticEvent} e Event.
     */
    /**
     * Invoke this from an `onResponderRelease` event.
     */
    /**
     * Invoke this from an `onResponderGrant` event.
     */
    /**
     * Unfortunately, `onScrollBeginDrag` also fires when *stopping* the scroll
     * animation, and there's not an easy way to distinguish a drag vs. stopping
     * momentum.
     *
     * Invoke this from an `onScrollBeginDrag` event.
     */
    /**
     * Invoke this from an `onScrollEndDrag` event.
     */
    /**
     * Invoke this from an `onMomentumScrollBegin` event.
     */
    /**
     * Invoke this from an `onMomentumScrollEnd` event.
     */
    /**
     * Invoke this from an `onTouchStart` event.
     *
     * Since we know that the `SimpleEventPlugin` occurs later in the plugin
     * order, after `ResponderEventPlugin`, we can detect that we were *not*
     * permitted to be the responder (presumably because a contained view became
     * responder). The `onResponderReject` won't fire in that case - it only
     * fires when a *current* responder rejects our request.
     *
     * @param {SyntheticEvent} e Touch Start event.
     */
    /**
     * Invoke this from an `onTouchMove` event.
     *
     * Since we know that the `SimpleEventPlugin` occurs later in the plugin
     * order, after `ResponderEventPlugin`, we can detect that we were *not*
     * permitted to be the responder (presumably because a contained view became
     * responder). The `onResponderReject` won't fire in that case - it only
     * fires when a *current* responder rejects our request.
     *
     * @param {SyntheticEvent} e Touch Start event.
     */
    /**
     * A helper function for this class that lets us quickly determine if the
     * view is currently animating. This is particularly useful to know when
     * a touch has just started or ended.
     */
    /**
     * A helper function to scroll to a specific point in the scrollview.
     * This is currently used to help focus on child textviews, but can also
     * be used to quickly scroll to any element we want to focus. Syntax:
     *
     * scrollResponderScrollTo(options: {x: number = 0; y: number = 0; animated: boolean = true})
     *
     * Note: The weird argument signature is due to the fact that, for historical reasons,
     * the function also accepts separate arguments as as alternative to the options object.
     * This is deprecated due to ambiguity (y before x), and SHOULD NOT BE USED.
     */
    /**
     * A helper function to zoom to a specific rect in the scrollview. The argument has the shape
     * {x: number; y: number; width: number; height: number; animated: boolean = true}
     *
     * @platform ios
     */
    /**
     * Displays the scroll indicators momentarily.
     */
    scrollResponderFlashScrollIndicators() {
    }
    /**
     * This method should be used as the callback to onFocus in a TextInputs'
     * parent view. Note that any module using this mixin needs to return
     * the parent view's ref in getScrollViewRef() in order to use this method.
     * @param {any} nodeHandle The TextInput node handle
     * @param {number} additionalOffset The scroll view's top "contentInset".
     *        Default is 0.
     * @param {bool} preventNegativeScrolling Whether to allow pulling the content
     *        down to make it meet the keyboard's top. Default is false.
     */
    /**
     * The calculations performed here assume the scroll view takes up the entire
     * screen - even if has some content inset. We then measure the offsets of the
     * keyboard, and compensate both for the scroll view's "contentInset".
     *
     * @param {number} left Position of input w.r.t. table view.
     * @param {number} top Position of input w.r.t. table view.
     * @param {number} width Width of the text input.
     * @param {number} height Height of the text input.
     */
    scrollResponderTextInputFocusError(e) {
      console.error("Error measuring text field: ", e);
    }
    /**
     * Warning, this may be called several times for a single keyboard opening.
     * It's best to store the information in this method and then take any action
     * at a later point (either in `keyboardDidShow` or other).
     *
     * Here's the order that events occur in:
     * - focus
     * - willShow {startCoordinates, endCoordinates} several times
     * - didShow several times
     * - blur
     * - willHide {startCoordinates, endCoordinates} several times
     * - didHide several times
     *
     * The `ScrollResponder` providesModule callbacks for each of these events.
     * Even though any user could have easily listened to keyboard events
     * themselves, using these `props` callbacks ensures that ordering of events
     * is consistent - and not dependent on the order that the keyboard events are
     * subscribed to. This matters when telling the scroll view to scroll to where
     * the keyboard is headed - the scroll responder better have been notified of
     * the keyboard destination before being instructed to scroll to where the
     * keyboard will be. Stick to the `ScrollResponder` callbacks, and everything
     * will work.
     *
     * WARNING: These callbacks will fire even if a keyboard is displayed in a
     * different navigation pane. Filter out the events to determine if they are
     * relevant to you. (For example, only if you receive these callbacks after
     * you had explicitly focused a node etc).
     */
    /**
     * ------------------------------------------------------
     * END SCROLLRESPONDER
     * ------------------------------------------------------
     */
    /**
     * Returns a reference to the underlying scroll responder, which supports
     * operations like `scrollTo`. All ScrollView-like components should
     * implement this method so that they can be composed while providing access
     * to the underlying scroll responder's methods.
     */
    /**
     * Scrolls to a given x, y offset, either immediately or with a smooth animation.
     * Syntax:
     *
     * scrollTo(options: {x: number = 0; y: number = 0; animated: boolean = true})
     *
     * Note: The weird argument signature is due to the fact that, for historical reasons,
     * the function also accepts separate arguments as as alternative to the options object.
     * This is deprecated due to ambiguity (y before x), and SHOULD NOT BE USED.
     */
    /**
     * If this is a vertical ScrollView scrolls to the bottom.
     * If this is a horizontal ScrollView scrolls to the right.
     *
     * Use `scrollToEnd({ animated: true })` for smooth animated scrolling,
     * `scrollToEnd({ animated: false })` for immediate scrolling.
     * If no options are passed, `animated` defaults to true.
     */
    render() {
      var _this$props = this.props, contentContainerStyle = _this$props.contentContainerStyle, horizontal = _this$props.horizontal, onContentSizeChange = _this$props.onContentSizeChange, refreshControl = _this$props.refreshControl, stickyHeaderIndices = _this$props.stickyHeaderIndices, pagingEnabled = _this$props.pagingEnabled, forwardedRef = _this$props.forwardedRef, keyboardDismissMode = _this$props.keyboardDismissMode, onScroll = _this$props.onScroll, centerContent = _this$props.centerContent, other = _objectWithoutPropertiesLoose(_this$props, _excluded7);
      if (false) {
        var style = StyleSheet_default.flatten(this.props.style);
        var childLayoutProps = ["alignItems", "justifyContent"].filter((prop) => style && style[prop] !== void 0);
        (0, import_invariant2.default)(childLayoutProps.length === 0, "ScrollView child layout (" + JSON.stringify(childLayoutProps) + ") must be applied through the contentContainerStyle prop.");
      }
      var contentSizeChangeProps = {};
      if (onContentSizeChange) {
        contentSizeChangeProps = {
          onLayout: this._handleContentOnLayout
        };
      }
      var hasStickyHeaderIndices = !horizontal && Array.isArray(stickyHeaderIndices);
      var children = hasStickyHeaderIndices || pagingEnabled ? import_react6.default.Children.map(this.props.children, (child, i) => {
        var isSticky = hasStickyHeaderIndices && stickyHeaderIndices.indexOf(i) > -1;
        if (child != null && (isSticky || pagingEnabled)) {
          return /* @__PURE__ */ import_react6.default.createElement(View_default, {
            style: [isSticky && styles3.stickyHeader, pagingEnabled && styles3.pagingEnabledChild]
          }, child);
        } else {
          return child;
        }
      }) : this.props.children;
      var contentContainer = /* @__PURE__ */ import_react6.default.createElement(View_default, _extends({}, contentSizeChangeProps, {
        children,
        collapsable: false,
        ref: this._setInnerViewRef,
        style: [horizontal && styles3.contentContainerHorizontal, centerContent && styles3.contentContainerCenterContent, contentContainerStyle]
      }));
      var baseStyle = horizontal ? styles3.baseHorizontal : styles3.baseVertical;
      var pagingEnabledStyle = horizontal ? styles3.pagingEnabledHorizontal : styles3.pagingEnabledVertical;
      var props = _objectSpread2(_objectSpread2({}, other), {}, {
        style: [baseStyle, pagingEnabled && pagingEnabledStyle, this.props.style],
        onTouchStart: this.scrollResponderHandleTouchStart,
        onTouchMove: this.scrollResponderHandleTouchMove,
        onTouchEnd: this.scrollResponderHandleTouchEnd,
        onScrollBeginDrag: this.scrollResponderHandleScrollBeginDrag,
        onScrollEndDrag: this.scrollResponderHandleScrollEndDrag,
        onMomentumScrollBegin: this.scrollResponderHandleMomentumScrollBegin,
        onMomentumScrollEnd: this.scrollResponderHandleMomentumScrollEnd,
        onStartShouldSetResponder: this.scrollResponderHandleStartShouldSetResponder,
        onStartShouldSetResponderCapture: this.scrollResponderHandleStartShouldSetResponderCapture,
        onScrollShouldSetResponder: this.scrollResponderHandleScrollShouldSetResponder,
        onScroll: this._handleScroll,
        onResponderGrant: this.scrollResponderHandleResponderGrant,
        onResponderTerminationRequest: this.scrollResponderHandleTerminationRequest,
        onResponderTerminate: this.scrollResponderHandleTerminate,
        onResponderRelease: this.scrollResponderHandleResponderRelease,
        onResponderReject: this.scrollResponderHandleResponderReject
      });
      var ScrollViewClass = ScrollViewBase_default;
      (0, import_invariant2.default)(ScrollViewClass !== void 0, "ScrollViewClass must not be undefined");
      var scrollView = /* @__PURE__ */ import_react6.default.createElement(ScrollViewClass, _extends({}, props, {
        ref: this._setScrollNodeRef
      }), contentContainer);
      if (refreshControl) {
        return /* @__PURE__ */ import_react6.default.cloneElement(refreshControl, {
          style: props.style
        }, scrollView);
      }
      return scrollView;
    }
  };
  var commonStyle = {
    flexGrow: 1,
    flexShrink: 1,
    // Enable hardware compositing in modern browsers.
    // Creates a new layer with its own backing surface that can significantly
    // improve scroll performance.
    transform: "translateZ(0)",
    // iOS native scrolling
    WebkitOverflowScrolling: "touch"
  };
  var styles3 = StyleSheet_default.create({
    baseVertical: _objectSpread2(_objectSpread2({}, commonStyle), {}, {
      flexDirection: "column",
      overflowX: "hidden",
      overflowY: "auto"
    }),
    baseHorizontal: _objectSpread2(_objectSpread2({}, commonStyle), {}, {
      flexDirection: "row",
      overflowX: "auto",
      overflowY: "hidden"
    }),
    contentContainerHorizontal: {
      flexDirection: "row"
    },
    contentContainerCenterContent: {
      justifyContent: "center",
      flexGrow: 1
    },
    stickyHeader: {
      position: "sticky",
      top: 0,
      zIndex: 10
    },
    pagingEnabledHorizontal: {
      scrollSnapType: "x mandatory"
    },
    pagingEnabledVertical: {
      scrollSnapType: "y mandatory"
    },
    pagingEnabledChild: {
      scrollSnapAlign: "start"
    }
  });
  var ForwardedScrollView = /* @__PURE__ */ import_react6.default.forwardRef((props, forwardedRef) => {
    return /* @__PURE__ */ import_react6.default.createElement(ScrollView, _extends({}, props, {
      forwardedRef
    }));
  });
  ForwardedScrollView.displayName = "ScrollView";
  var ScrollView_default = ForwardedScrollView;

  // node_modules/react-native-web/dist/exports/InteractionManager/index.js
  var import_invariant4 = __toESM(require_invariant());

  // node_modules/react-native-web/dist/exports/InteractionManager/TaskQueue.js
  var import_invariant3 = __toESM(require_invariant());
  var TaskQueue = class {
    constructor(_ref) {
      var onMoreTasks = _ref.onMoreTasks;
      this._onMoreTasks = onMoreTasks;
      this._queueStack = [{
        tasks: [],
        popable: true
      }];
    }
    enqueue(task) {
      this._getCurrentQueue().push(task);
    }
    enqueueTasks(tasks) {
      tasks.forEach((task) => this.enqueue(task));
    }
    cancelTasks(tasksToCancel) {
      this._queueStack = this._queueStack.map((queue) => _objectSpread2(_objectSpread2({}, queue), {}, {
        tasks: queue.tasks.filter((task) => tasksToCancel.indexOf(task) === -1)
      })).filter((queue, idx) => queue.tasks.length > 0 || idx === 0);
    }
    hasTasksToProcess() {
      return this._getCurrentQueue().length > 0;
    }
    /**
     * Executes the next task in the queue.
     */
    processNext() {
      var queue = this._getCurrentQueue();
      if (queue.length) {
        var task = queue.shift();
        try {
          if (typeof task === "object" && task.gen) {
            this._genPromise(task);
          } else if (typeof task === "object" && task.run) {
            task.run();
          } else {
            (0, import_invariant3.default)(typeof task === "function", "Expected Function, SimpleTask, or PromiseTask, but got:\n" + JSON.stringify(task, null, 2));
            task();
          }
        } catch (e) {
          e.message = "TaskQueue: Error with task " + (task.name || "") + ": " + e.message;
          throw e;
        }
      }
    }
    _getCurrentQueue() {
      var stackIdx = this._queueStack.length - 1;
      var queue = this._queueStack[stackIdx];
      if (queue.popable && queue.tasks.length === 0 && stackIdx > 0) {
        this._queueStack.pop();
        return this._getCurrentQueue();
      } else {
        return queue.tasks;
      }
    }
    _genPromise(task) {
      var length = this._queueStack.push({
        tasks: [],
        popable: false
      });
      var stackIdx = length - 1;
      var stackItem = this._queueStack[stackIdx];
      task.gen().then(() => {
        stackItem.popable = true;
        this.hasTasksToProcess() && this._onMoreTasks();
      }).catch((ex) => {
        setTimeout(() => {
          ex.message = "TaskQueue: Error resolving Promise in task " + task.name + ": " + ex.message;
          throw ex;
        }, 0);
      });
    }
  };
  var TaskQueue_default = TaskQueue;

  // node_modules/react-native-web/dist/vendor/react-native/vendor/emitter/EventEmitter.js
  var EventEmitter = class {
    constructor() {
      this._registry = {};
    }
    /**
     * Registers a listener that is called when the supplied event is emitted.
     * Returns a subscription that has a `remove` method to undo registration.
     */
    addListener(eventType, listener, context) {
      var registrations = allocate(this._registry, eventType);
      var registration = {
        context,
        listener,
        remove() {
          registrations.delete(registration);
        }
      };
      registrations.add(registration);
      return registration;
    }
    /**
     * Emits the supplied event. Additional arguments supplied to `emit` will be
     * passed through to each of the registered listeners.
     *
     * If a listener modifies the listeners registered for the same event, those
     * changes will not be reflected in the current invocation of `emit`.
     */
    emit(eventType) {
      var registrations = this._registry[eventType];
      if (registrations != null) {
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }
        for (var _i = 0, _arr = [...registrations]; _i < _arr.length; _i++) {
          var registration = _arr[_i];
          registration.listener.apply(registration.context, args);
        }
      }
    }
    /**
     * Removes all registered listeners.
     */
    removeAllListeners(eventType) {
      if (eventType == null) {
        this._registry = {};
      } else {
        delete this._registry[eventType];
      }
    }
    /**
     * Returns the number of registered listeners for the supplied event.
     */
    listenerCount(eventType) {
      var registrations = this._registry[eventType];
      return registrations == null ? 0 : registrations.size;
    }
  };
  function allocate(registry, eventType) {
    var registrations = registry[eventType];
    if (registrations == null) {
      registrations = /* @__PURE__ */ new Set();
      registry[eventType] = registrations;
    }
    return registrations;
  }

  // node_modules/react-native-web/dist/modules/requestIdleCallback/index.js
  var _requestIdleCallback = function _requestIdleCallback2(cb, options) {
    return setTimeout(() => {
      var start = Date.now();
      cb({
        didTimeout: false,
        timeRemaining() {
          return Math.max(0, 50 - (Date.now() - start));
        }
      });
    }, 1);
  };
  var _cancelIdleCallback = function _cancelIdleCallback2(id) {
    clearTimeout(id);
  };
  var isSupported = canUseDom_default && typeof window.requestIdleCallback !== "undefined";
  var requestIdleCallback = isSupported ? window.requestIdleCallback : _requestIdleCallback;
  var cancelIdleCallback = isSupported ? window.cancelIdleCallback : _cancelIdleCallback;
  var requestIdleCallback_default = requestIdleCallback;

  // node_modules/react-native-web/dist/exports/InteractionManager/index.js
  var _emitter = new EventEmitter();
  var InteractionManager = {
    Events: {
      interactionStart: "interactionStart",
      interactionComplete: "interactionComplete"
    },
    /**
     * Schedule a function to run after all interactions have completed.
     */
    runAfterInteractions(task) {
      var tasks = [];
      var promise = new Promise((resolve) => {
        _scheduleUpdate();
        if (task) {
          tasks.push(task);
        }
        tasks.push({
          run: resolve,
          name: "resolve " + (task && task.name || "?")
        });
        _taskQueue.enqueueTasks(tasks);
      });
      return {
        then: promise.then.bind(promise),
        done: promise.then.bind(promise),
        cancel: () => {
          _taskQueue.cancelTasks(tasks);
        }
      };
    },
    /**
     * Notify manager that an interaction has started.
     */
    createInteractionHandle() {
      _scheduleUpdate();
      var handle = ++_inc;
      _addInteractionSet.add(handle);
      return handle;
    },
    /**
     * Notify manager that an interaction has completed.
     */
    clearInteractionHandle(handle) {
      (0, import_invariant4.default)(!!handle, "Must provide a handle to clear.");
      _scheduleUpdate();
      _addInteractionSet.delete(handle);
      _deleteInteractionSet.add(handle);
    },
    addListener: _emitter.addListener.bind(_emitter),
    /**
     *
     * @param deadline
     */
    setDeadline(deadline) {
      _deadline = deadline;
    }
  };
  var _interactionSet = /* @__PURE__ */ new Set();
  var _addInteractionSet = /* @__PURE__ */ new Set();
  var _deleteInteractionSet = /* @__PURE__ */ new Set();
  var _taskQueue = new TaskQueue_default({
    onMoreTasks: _scheduleUpdate
  });
  var _nextUpdateHandle = 0;
  var _inc = 0;
  var _deadline = -1;
  function _scheduleUpdate() {
    if (!_nextUpdateHandle) {
      if (_deadline > 0) {
        _nextUpdateHandle = setTimeout(_processUpdate);
      } else {
        _nextUpdateHandle = requestIdleCallback_default(_processUpdate);
      }
    }
  }
  function _processUpdate() {
    _nextUpdateHandle = 0;
    var interactionCount = _interactionSet.size;
    _addInteractionSet.forEach((handle) => _interactionSet.add(handle));
    _deleteInteractionSet.forEach((handle) => _interactionSet.delete(handle));
    var nextInteractionCount = _interactionSet.size;
    if (interactionCount !== 0 && nextInteractionCount === 0) {
      _emitter.emit(InteractionManager.Events.interactionComplete);
    } else if (interactionCount === 0 && nextInteractionCount !== 0) {
      _emitter.emit(InteractionManager.Events.interactionStart);
    }
    if (nextInteractionCount === 0) {
      var begin = Date.now();
      while (_taskQueue.hasTasksToProcess()) {
        _taskQueue.processNext();
        if (_deadline > 0 && Date.now() - begin >= _deadline) {
          _scheduleUpdate();
          break;
        }
      }
    }
    _addInteractionSet.clear();
    _deleteInteractionSet.clear();
  }
  var InteractionManager_default = InteractionManager;

  // node_modules/react-native-web/dist/vendor/react-native/Batchinator/index.js
  var Batchinator = class {
    constructor(callback, delayMS) {
      this._delay = delayMS;
      this._callback = callback;
    }
    /*
     * Cleanup any pending tasks.
     *
     * By default, if there is a pending task the callback is run immediately. Set the option abort to
     * true to not call the callback if it was pending.
     */
    dispose(options) {
      if (options === void 0) {
        options = {
          abort: false
        };
      }
      if (this._taskHandle) {
        this._taskHandle.cancel();
        if (!options.abort) {
          this._callback();
        }
        this._taskHandle = null;
      }
    }
    schedule() {
      if (this._taskHandle) {
        return;
      }
      var timeoutHandle = setTimeout(() => {
        this._taskHandle = InteractionManager_default.runAfterInteractions(() => {
          this._taskHandle = null;
          this._callback();
        });
      }, this._delay);
      this._taskHandle = {
        cancel: () => clearTimeout(timeoutHandle)
      };
    }
  };
  var Batchinator_default = Batchinator;

  // node_modules/react-native-web/dist/vendor/react-native/Utilities/clamp.js
  function clamp(min, value, max) {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }
  var clamp_default = clamp;

  // node_modules/react-native-web/dist/vendor/react-native/infoLog/index.js
  function infoLog() {
    return console.log(...arguments);
  }
  var infoLog_default = infoLog;

  // node_modules/react-native-web/dist/vendor/react-native/VirtualizedList/CellRenderMask.js
  var import_invariant5 = __toESM(require_invariant());
  var CellRenderMask = class {
    constructor(numCells) {
      (0, import_invariant5.default)(numCells >= 0, "CellRenderMask must contain a non-negative number os cells");
      this._numCells = numCells;
      if (numCells === 0) {
        this._regions = [];
      } else {
        this._regions = [{
          first: 0,
          last: numCells - 1,
          isSpacer: true
        }];
      }
    }
    enumerateRegions() {
      return this._regions;
    }
    addCells(cells) {
      (0, import_invariant5.default)(cells.first >= 0 && cells.first < this._numCells && cells.last >= -1 && cells.last < this._numCells && cells.last >= cells.first - 1, "CellRenderMask.addCells called with invalid cell range");
      if (cells.last < cells.first) {
        return;
      }
      var _this$_findRegion = this._findRegion(cells.first), firstIntersect = _this$_findRegion[0], firstIntersectIdx = _this$_findRegion[1];
      var _this$_findRegion2 = this._findRegion(cells.last), lastIntersect = _this$_findRegion2[0], lastIntersectIdx = _this$_findRegion2[1];
      if (firstIntersectIdx === lastIntersectIdx && !firstIntersect.isSpacer) {
        return;
      }
      var newLeadRegion = [];
      var newTailRegion = [];
      var newMainRegion = _objectSpread2(_objectSpread2({}, cells), {}, {
        isSpacer: false
      });
      if (firstIntersect.first < newMainRegion.first) {
        if (firstIntersect.isSpacer) {
          newLeadRegion.push({
            first: firstIntersect.first,
            last: newMainRegion.first - 1,
            isSpacer: true
          });
        } else {
          newMainRegion.first = firstIntersect.first;
        }
      }
      if (lastIntersect.last > newMainRegion.last) {
        if (lastIntersect.isSpacer) {
          newTailRegion.push({
            first: newMainRegion.last + 1,
            last: lastIntersect.last,
            isSpacer: true
          });
        } else {
          newMainRegion.last = lastIntersect.last;
        }
      }
      var replacementRegions = [...newLeadRegion, newMainRegion, ...newTailRegion];
      var numRegionsToDelete = lastIntersectIdx - firstIntersectIdx + 1;
      this._regions.splice(firstIntersectIdx, numRegionsToDelete, ...replacementRegions);
    }
    numCells() {
      return this._numCells;
    }
    equals(other) {
      return this._numCells === other._numCells && this._regions.length === other._regions.length && this._regions.every((region, i) => region.first === other._regions[i].first && region.last === other._regions[i].last && region.isSpacer === other._regions[i].isSpacer);
    }
    _findRegion(cellIdx) {
      var firstIdx = 0;
      var lastIdx = this._regions.length - 1;
      while (firstIdx <= lastIdx) {
        var middleIdx = Math.floor((firstIdx + lastIdx) / 2);
        var middleRegion = this._regions[middleIdx];
        if (cellIdx >= middleRegion.first && cellIdx <= middleRegion.last) {
          return [middleRegion, middleIdx];
        } else if (cellIdx < middleRegion.first) {
          lastIdx = middleIdx - 1;
        } else if (cellIdx > middleRegion.last) {
          firstIdx = middleIdx + 1;
        }
      }
      (0, import_invariant5.default)(false, "A region was not found containing cellIdx " + cellIdx);
    }
  };

  // node_modules/react-native-web/dist/vendor/react-native/VirtualizedList/ChildListCollection.js
  var import_invariant6 = __toESM(require_invariant());
  var ChildListCollection = class {
    constructor() {
      this._cellKeyToChildren = /* @__PURE__ */ new Map();
      this._childrenToCellKey = /* @__PURE__ */ new Map();
    }
    add(list, cellKey) {
      var _this$_cellKeyToChild;
      (0, import_invariant6.default)(!this._childrenToCellKey.has(list), "Trying to add already present child list");
      var cellLists = (_this$_cellKeyToChild = this._cellKeyToChildren.get(cellKey)) !== null && _this$_cellKeyToChild !== void 0 ? _this$_cellKeyToChild : /* @__PURE__ */ new Set();
      cellLists.add(list);
      this._cellKeyToChildren.set(cellKey, cellLists);
      this._childrenToCellKey.set(list, cellKey);
    }
    remove(list) {
      var cellKey = this._childrenToCellKey.get(list);
      (0, import_invariant6.default)(cellKey != null, "Trying to remove non-present child list");
      this._childrenToCellKey.delete(list);
      var cellLists = this._cellKeyToChildren.get(cellKey);
      (0, import_invariant6.default)(cellLists, "_cellKeyToChildren should contain cellKey");
      cellLists.delete(list);
      if (cellLists.size === 0) {
        this._cellKeyToChildren.delete(cellKey);
      }
    }
    forEach(fn) {
      for (var _iterator = _createForOfIteratorHelperLoose(this._cellKeyToChildren.values()), _step; !(_step = _iterator()).done; ) {
        var listSet = _step.value;
        for (var _iterator2 = _createForOfIteratorHelperLoose(listSet), _step2; !(_step2 = _iterator2()).done; ) {
          var list = _step2.value;
          fn(list);
        }
      }
    }
    forEachInCell(cellKey, fn) {
      var _this$_cellKeyToChild2;
      var listSet = (_this$_cellKeyToChild2 = this._cellKeyToChildren.get(cellKey)) !== null && _this$_cellKeyToChild2 !== void 0 ? _this$_cellKeyToChild2 : [];
      for (var _iterator3 = _createForOfIteratorHelperLoose(listSet), _step3; !(_step3 = _iterator3()).done; ) {
        var list = _step3.value;
        fn(list);
      }
    }
    anyInCell(cellKey, fn) {
      var _this$_cellKeyToChild3;
      var listSet = (_this$_cellKeyToChild3 = this._cellKeyToChildren.get(cellKey)) !== null && _this$_cellKeyToChild3 !== void 0 ? _this$_cellKeyToChild3 : [];
      for (var _iterator4 = _createForOfIteratorHelperLoose(listSet), _step4; !(_step4 = _iterator4()).done; ) {
        var list = _step4.value;
        if (fn(list)) {
          return true;
        }
      }
      return false;
    }
    size() {
      return this._childrenToCellKey.size;
    }
  };

  // node_modules/react-native-web/dist/vendor/react-native/FillRateHelper/index.js
  var Info = class {
    constructor() {
      this.any_blank_count = 0;
      this.any_blank_ms = 0;
      this.any_blank_speed_sum = 0;
      this.mostly_blank_count = 0;
      this.mostly_blank_ms = 0;
      this.pixels_blank = 0;
      this.pixels_sampled = 0;
      this.pixels_scrolled = 0;
      this.total_time_spent = 0;
      this.sample_count = 0;
    }
  };
  var DEBUG = false;
  var _listeners = [];
  var _minSampleCount = 10;
  var _sampleRate = DEBUG ? 1 : null;
  var FillRateHelper = class {
    static addListener(callback) {
      if (_sampleRate === null) {
        console.warn("Call `FillRateHelper.setSampleRate` before `addListener`.");
      }
      _listeners.push(callback);
      return {
        remove: () => {
          _listeners = _listeners.filter((listener) => callback !== listener);
        }
      };
    }
    static setSampleRate(sampleRate) {
      _sampleRate = sampleRate;
    }
    static setMinSampleCount(minSampleCount) {
      _minSampleCount = minSampleCount;
    }
    constructor(getFrameMetrics) {
      this._anyBlankStartTime = null;
      this._enabled = false;
      this._info = new Info();
      this._mostlyBlankStartTime = null;
      this._samplesStartTime = null;
      this._getFrameMetrics = getFrameMetrics;
      this._enabled = (_sampleRate || 0) > Math.random();
      this._resetData();
    }
    activate() {
      if (this._enabled && this._samplesStartTime == null) {
        DEBUG && console.debug("FillRateHelper: activate");
        this._samplesStartTime = global.performance.now();
      }
    }
    deactivateAndFlush() {
      if (!this._enabled) {
        return;
      }
      var start = this._samplesStartTime;
      if (start == null) {
        DEBUG && console.debug("FillRateHelper: bail on deactivate with no start time");
        return;
      }
      if (this._info.sample_count < _minSampleCount) {
        this._resetData();
        return;
      }
      var total_time_spent = global.performance.now() - start;
      var info = _objectSpread2(_objectSpread2({}, this._info), {}, {
        total_time_spent
      });
      if (DEBUG) {
        var derived = {
          avg_blankness: this._info.pixels_blank / this._info.pixels_sampled,
          avg_speed: this._info.pixels_scrolled / (total_time_spent / 1e3),
          avg_speed_when_any_blank: this._info.any_blank_speed_sum / this._info.any_blank_count,
          any_blank_per_min: this._info.any_blank_count / (total_time_spent / 1e3 / 60),
          any_blank_time_frac: this._info.any_blank_ms / total_time_spent,
          mostly_blank_per_min: this._info.mostly_blank_count / (total_time_spent / 1e3 / 60),
          mostly_blank_time_frac: this._info.mostly_blank_ms / total_time_spent
        };
        for (var key in derived) {
          derived[key] = Math.round(1e3 * derived[key]) / 1e3;
        }
        console.debug("FillRateHelper deactivateAndFlush: ", {
          derived,
          info
        });
      }
      _listeners.forEach((listener) => listener(info));
      this._resetData();
    }
    computeBlankness(props, cellsAroundViewport, scrollMetrics) {
      if (!this._enabled || props.getItemCount(props.data) === 0 || cellsAroundViewport.last < cellsAroundViewport.first || this._samplesStartTime == null) {
        return 0;
      }
      var dOffset = scrollMetrics.dOffset, offset = scrollMetrics.offset, velocity = scrollMetrics.velocity, visibleLength = scrollMetrics.visibleLength;
      this._info.sample_count++;
      this._info.pixels_sampled += Math.round(visibleLength);
      this._info.pixels_scrolled += Math.round(Math.abs(dOffset));
      var scrollSpeed = Math.round(Math.abs(velocity) * 1e3);
      var now = global.performance.now();
      if (this._anyBlankStartTime != null) {
        this._info.any_blank_ms += now - this._anyBlankStartTime;
      }
      this._anyBlankStartTime = null;
      if (this._mostlyBlankStartTime != null) {
        this._info.mostly_blank_ms += now - this._mostlyBlankStartTime;
      }
      this._mostlyBlankStartTime = null;
      var blankTop = 0;
      var first = cellsAroundViewport.first;
      var firstFrame = this._getFrameMetrics(first, props);
      while (first <= cellsAroundViewport.last && (!firstFrame || !firstFrame.inLayout)) {
        firstFrame = this._getFrameMetrics(first, props);
        first++;
      }
      if (firstFrame && first > 0) {
        blankTop = Math.min(visibleLength, Math.max(0, firstFrame.offset - offset));
      }
      var blankBottom = 0;
      var last = cellsAroundViewport.last;
      var lastFrame = this._getFrameMetrics(last, props);
      while (last >= cellsAroundViewport.first && (!lastFrame || !lastFrame.inLayout)) {
        lastFrame = this._getFrameMetrics(last, props);
        last--;
      }
      if (lastFrame && last < props.getItemCount(props.data) - 1) {
        var bottomEdge = lastFrame.offset + lastFrame.length;
        blankBottom = Math.min(visibleLength, Math.max(0, offset + visibleLength - bottomEdge));
      }
      var pixels_blank = Math.round(blankTop + blankBottom);
      var blankness = pixels_blank / visibleLength;
      if (blankness > 0) {
        this._anyBlankStartTime = now;
        this._info.any_blank_speed_sum += scrollSpeed;
        this._info.any_blank_count++;
        this._info.pixels_blank += pixels_blank;
        if (blankness > 0.5) {
          this._mostlyBlankStartTime = now;
          this._info.mostly_blank_count++;
        }
      } else if (scrollSpeed < 0.01 || Math.abs(dOffset) < 1) {
        this.deactivateAndFlush();
      }
      return blankness;
    }
    enabled() {
      return this._enabled;
    }
    _resetData() {
      this._anyBlankStartTime = null;
      this._info = new Info();
      this._mostlyBlankStartTime = null;
      this._samplesStartTime = null;
    }
  };
  var FillRateHelper_default = FillRateHelper;

  // node_modules/react-native-web/dist/vendor/react-native/VirtualizedList/StateSafePureComponent.js
  var import_invariant7 = __toESM(require_invariant());
  var React11 = __toESM(require_react());
  var StateSafePureComponent = class extends React11.PureComponent {
    constructor(props) {
      super(props);
      this._inAsyncStateUpdate = false;
      this._installSetStateHooks();
    }
    setState(partialState, callback) {
      if (typeof partialState === "function") {
        super.setState((state, props) => {
          this._inAsyncStateUpdate = true;
          var ret;
          try {
            ret = partialState(state, props);
          } catch (err) {
            throw err;
          } finally {
            this._inAsyncStateUpdate = false;
          }
          return ret;
        }, callback);
      } else {
        super.setState(partialState, callback);
      }
    }
    _installSetStateHooks() {
      var that = this;
      var props = this.props, state = this.state;
      Object.defineProperty(this, "props", {
        get() {
          (0, import_invariant7.default)(!that._inAsyncStateUpdate, '"this.props" should not be accessed during state updates');
          return props;
        },
        set(newProps) {
          props = newProps;
        }
      });
      Object.defineProperty(this, "state", {
        get() {
          (0, import_invariant7.default)(!that._inAsyncStateUpdate, '"this.state" should not be acceessed during state updates');
          return state;
        },
        set(newState) {
          state = newState;
        }
      });
    }
  };

  // node_modules/react-native-web/dist/vendor/react-native/ViewabilityHelper/index.js
  var import_invariant8 = __toESM(require_invariant());
  var ViewabilityHelper = class {
    constructor(config) {
      if (config === void 0) {
        config = {
          viewAreaCoveragePercentThreshold: 0
        };
      }
      this._hasInteracted = false;
      this._timers = /* @__PURE__ */ new Set();
      this._viewableIndices = [];
      this._viewableItems = /* @__PURE__ */ new Map();
      this._config = config;
    }
    /**
     * Cleanup, e.g. on unmount. Clears any pending timers.
     */
    dispose() {
      this._timers.forEach(clearTimeout);
    }
    /**
     * Determines which items are viewable based on the current metrics and config.
     */
    computeViewableItems(props, scrollOffset, viewportHeight, getFrameMetrics, renderRange) {
      var itemCount = props.getItemCount(props.data);
      var _this$_config = this._config, itemVisiblePercentThreshold = _this$_config.itemVisiblePercentThreshold, viewAreaCoveragePercentThreshold = _this$_config.viewAreaCoveragePercentThreshold;
      var viewAreaMode = viewAreaCoveragePercentThreshold != null;
      var viewablePercentThreshold = viewAreaMode ? viewAreaCoveragePercentThreshold : itemVisiblePercentThreshold;
      (0, import_invariant8.default)(viewablePercentThreshold != null && itemVisiblePercentThreshold != null !== (viewAreaCoveragePercentThreshold != null), "Must set exactly one of itemVisiblePercentThreshold or viewAreaCoveragePercentThreshold");
      var viewableIndices = [];
      if (itemCount === 0) {
        return viewableIndices;
      }
      var firstVisible = -1;
      var _ref = renderRange || {
        first: 0,
        last: itemCount - 1
      }, first = _ref.first, last = _ref.last;
      if (last >= itemCount) {
        console.warn("Invalid render range computing viewability " + JSON.stringify({
          renderRange,
          itemCount
        }));
        return [];
      }
      for (var idx = first; idx <= last; idx++) {
        var metrics = getFrameMetrics(idx, props);
        if (!metrics) {
          continue;
        }
        var top = metrics.offset - scrollOffset;
        var bottom = top + metrics.length;
        if (top < viewportHeight && bottom > 0) {
          firstVisible = idx;
          if (_isViewable(viewAreaMode, viewablePercentThreshold, top, bottom, viewportHeight, metrics.length)) {
            viewableIndices.push(idx);
          }
        } else if (firstVisible >= 0) {
          break;
        }
      }
      return viewableIndices;
    }
    /**
     * Figures out which items are viewable and how that has changed from before and calls
     * `onViewableItemsChanged` as appropriate.
     */
    onUpdate(props, scrollOffset, viewportHeight, getFrameMetrics, createViewToken, onViewableItemsChanged, renderRange) {
      var itemCount = props.getItemCount(props.data);
      if (this._config.waitForInteraction && !this._hasInteracted || itemCount === 0 || !getFrameMetrics(0, props)) {
        return;
      }
      var viewableIndices = [];
      if (itemCount) {
        viewableIndices = this.computeViewableItems(props, scrollOffset, viewportHeight, getFrameMetrics, renderRange);
      }
      if (this._viewableIndices.length === viewableIndices.length && this._viewableIndices.every((v, ii) => v === viewableIndices[ii])) {
        return;
      }
      this._viewableIndices = viewableIndices;
      if (this._config.minimumViewTime) {
        var handle = setTimeout(() => {
          this._timers.delete(handle);
          this._onUpdateSync(props, viewableIndices, onViewableItemsChanged, createViewToken);
        }, this._config.minimumViewTime);
        this._timers.add(handle);
      } else {
        this._onUpdateSync(props, viewableIndices, onViewableItemsChanged, createViewToken);
      }
    }
    /**
     * clean-up cached _viewableIndices to evaluate changed items on next update
     */
    resetViewableIndices() {
      this._viewableIndices = [];
    }
    /**
     * Records that an interaction has happened even if there has been no scroll.
     */
    recordInteraction() {
      this._hasInteracted = true;
    }
    _onUpdateSync(props, viewableIndicesToCheck, onViewableItemsChanged, createViewToken) {
      viewableIndicesToCheck = viewableIndicesToCheck.filter((ii) => this._viewableIndices.includes(ii));
      var prevItems = this._viewableItems;
      var nextItems = new Map(viewableIndicesToCheck.map((ii) => {
        var viewable2 = createViewToken(ii, true, props);
        return [viewable2.key, viewable2];
      }));
      var changed = [];
      for (var _iterator = _createForOfIteratorHelperLoose(nextItems), _step; !(_step = _iterator()).done; ) {
        var _step$value = _step.value, key = _step$value[0], viewable = _step$value[1];
        if (!prevItems.has(key)) {
          changed.push(viewable);
        }
      }
      for (var _iterator2 = _createForOfIteratorHelperLoose(prevItems), _step2; !(_step2 = _iterator2()).done; ) {
        var _step2$value = _step2.value, _key = _step2$value[0], _viewable = _step2$value[1];
        if (!nextItems.has(_key)) {
          changed.push(_objectSpread2(_objectSpread2({}, _viewable), {}, {
            isViewable: false
          }));
        }
      }
      if (changed.length > 0) {
        this._viewableItems = nextItems;
        onViewableItemsChanged({
          viewableItems: Array.from(nextItems.values()),
          changed,
          viewabilityConfig: this._config
        });
      }
    }
  };
  function _isViewable(viewAreaMode, viewablePercentThreshold, top, bottom, viewportHeight, itemLength) {
    if (_isEntirelyVisible(top, bottom, viewportHeight)) {
      return true;
    } else {
      var pixels = _getPixelsVisible(top, bottom, viewportHeight);
      var percent = 100 * (viewAreaMode ? pixels / viewportHeight : pixels / itemLength);
      return percent >= viewablePercentThreshold;
    }
  }
  function _getPixelsVisible(top, bottom, viewportHeight) {
    var visibleHeight = Math.min(bottom, viewportHeight) - Math.max(top, 0);
    return Math.max(0, visibleHeight);
  }
  function _isEntirelyVisible(top, bottom, viewportHeight) {
    return top >= 0 && bottom <= viewportHeight && bottom > top;
  }
  var ViewabilityHelper_default = ViewabilityHelper;

  // node_modules/react-native-web/dist/vendor/react-native/VirtualizedList/VirtualizedListContext.js
  var React12 = __toESM(require_react());
  var import_react7 = __toESM(require_react());
  var __DEV__2 = false;
  var VirtualizedListContext = /* @__PURE__ */ React12.createContext(null);
  if (__DEV__2) {
    VirtualizedListContext.displayName = "VirtualizedListContext";
  }
  function VirtualizedListContextProvider(_ref2) {
    var children = _ref2.children, value = _ref2.value;
    var context = (0, import_react7.useMemo)(() => ({
      cellKey: null,
      getScrollMetrics: value.getScrollMetrics,
      horizontal: value.horizontal,
      getOutermostParentListRef: value.getOutermostParentListRef,
      registerAsNestedChild: value.registerAsNestedChild,
      unregisterAsNestedChild: value.unregisterAsNestedChild
    }), [value.getScrollMetrics, value.horizontal, value.getOutermostParentListRef, value.registerAsNestedChild, value.unregisterAsNestedChild]);
    return /* @__PURE__ */ React12.createElement(VirtualizedListContext.Provider, {
      value: context
    }, children);
  }
  function VirtualizedListCellContextProvider(_ref3) {
    var cellKey = _ref3.cellKey, children = _ref3.children;
    var currContext = (0, import_react7.useContext)(VirtualizedListContext);
    var context = (0, import_react7.useMemo)(() => currContext == null ? null : _objectSpread2(_objectSpread2({}, currContext), {}, {
      cellKey
    }), [currContext, cellKey]);
    return /* @__PURE__ */ React12.createElement(VirtualizedListContext.Provider, {
      value: context
    }, children);
  }

  // node_modules/react-native-web/dist/vendor/react-native/VirtualizedList/VirtualizedListCellRenderer.js
  var import_invariant9 = __toESM(require_invariant());
  var React13 = __toESM(require_react());
  var CellRenderer = class extends React13.Component {
    constructor() {
      super(...arguments);
      this.state = {
        separatorProps: {
          highlighted: false,
          leadingItem: this.props.item
        }
      };
      this._separators = {
        highlight: () => {
          var _this$props = this.props, cellKey = _this$props.cellKey, prevCellKey = _this$props.prevCellKey;
          this.props.onUpdateSeparators([cellKey, prevCellKey], {
            highlighted: true
          });
        },
        unhighlight: () => {
          var _this$props2 = this.props, cellKey = _this$props2.cellKey, prevCellKey = _this$props2.prevCellKey;
          this.props.onUpdateSeparators([cellKey, prevCellKey], {
            highlighted: false
          });
        },
        updateProps: (select, newProps) => {
          var _this$props3 = this.props, cellKey = _this$props3.cellKey, prevCellKey = _this$props3.prevCellKey;
          this.props.onUpdateSeparators([select === "leading" ? prevCellKey : cellKey], newProps);
        }
      };
      this._onLayout = (nativeEvent) => {
        this.props.onCellLayout && this.props.onCellLayout(nativeEvent, this.props.cellKey, this.props.index);
      };
    }
    static getDerivedStateFromProps(props, prevState) {
      return {
        separatorProps: _objectSpread2(_objectSpread2({}, prevState.separatorProps), {}, {
          leadingItem: props.item
        })
      };
    }
    // TODO: consider factoring separator stuff out of VirtualizedList into FlatList since it's not
    // reused by SectionList and we can keep VirtualizedList simpler.
    // $FlowFixMe[missing-local-annot]
    updateSeparatorProps(newProps) {
      this.setState((state) => ({
        separatorProps: _objectSpread2(_objectSpread2({}, state.separatorProps), newProps)
      }));
    }
    componentWillUnmount() {
      this.props.onUnmount(this.props.cellKey);
    }
    _renderElement(renderItem, ListItemComponent, item, index) {
      if (renderItem && ListItemComponent) {
        console.warn("VirtualizedList: Both ListItemComponent and renderItem props are present. ListItemComponent will take precedence over renderItem.");
      }
      if (ListItemComponent) {
        return /* @__PURE__ */ React13.createElement(ListItemComponent, {
          item,
          index,
          separators: this._separators
        });
      }
      if (renderItem) {
        return renderItem({
          item,
          index,
          separators: this._separators
        });
      }
      (0, import_invariant9.default)(false, "VirtualizedList: Either ListItemComponent or renderItem props are required but none were found.");
    }
    render() {
      var _this$props4 = this.props, CellRendererComponent = _this$props4.CellRendererComponent, ItemSeparatorComponent = _this$props4.ItemSeparatorComponent, ListItemComponent = _this$props4.ListItemComponent, cellKey = _this$props4.cellKey, horizontal = _this$props4.horizontal, item = _this$props4.item, index = _this$props4.index, inversionStyle = _this$props4.inversionStyle, onCellFocusCapture = _this$props4.onCellFocusCapture, onCellLayout = _this$props4.onCellLayout, renderItem = _this$props4.renderItem;
      var element = this._renderElement(renderItem, ListItemComponent, item, index);
      var itemSeparator = /* @__PURE__ */ React13.isValidElement(ItemSeparatorComponent) ? (
        // $FlowFixMe[incompatible-type]
        ItemSeparatorComponent
      ) : (
        // $FlowFixMe[incompatible-type]
        ItemSeparatorComponent && /* @__PURE__ */ React13.createElement(ItemSeparatorComponent, this.state.separatorProps)
      );
      var cellStyle = inversionStyle ? horizontal ? [styles4.rowReverse, inversionStyle] : [styles4.columnReverse, inversionStyle] : horizontal ? [styles4.row, inversionStyle] : inversionStyle;
      var result = !CellRendererComponent ? /* @__PURE__ */ React13.createElement(View_default, _extends({
        style: cellStyle,
        onFocusCapture: onCellFocusCapture
      }, onCellLayout && {
        onLayout: this._onLayout
      }), element, itemSeparator) : /* @__PURE__ */ React13.createElement(CellRendererComponent, _extends({
        cellKey,
        index,
        item,
        style: cellStyle,
        onFocusCapture: onCellFocusCapture
      }, onCellLayout && {
        onLayout: this._onLayout
      }), element, itemSeparator);
      return /* @__PURE__ */ React13.createElement(VirtualizedListCellContextProvider, {
        cellKey: this.props.cellKey
      }, result);
    }
  };
  var styles4 = StyleSheet_default.create({
    row: {
      flexDirection: "row"
    },
    rowReverse: {
      flexDirection: "row-reverse"
    },
    columnReverse: {
      flexDirection: "column-reverse"
    }
  });

  // node_modules/react-native-web/dist/vendor/react-native/VirtualizeUtils/index.js
  function elementsThatOverlapOffsets(offsets, props, getFrameMetrics, zoomScale) {
    if (zoomScale === void 0) {
      zoomScale = 1;
    }
    var itemCount = props.getItemCount(props.data);
    var result = [];
    for (var offsetIndex = 0; offsetIndex < offsets.length; offsetIndex++) {
      var currentOffset = offsets[offsetIndex];
      var left2 = 0;
      var right2 = itemCount - 1;
      while (left2 <= right2) {
        var mid = left2 + (right2 - left2 >>> 1);
        var frame = getFrameMetrics(mid, props);
        var scaledOffsetStart = frame.offset * zoomScale;
        var scaledOffsetEnd = (frame.offset + frame.length) * zoomScale;
        if (mid === 0 && currentOffset < scaledOffsetStart || mid !== 0 && currentOffset <= scaledOffsetStart) {
          right2 = mid - 1;
        } else if (currentOffset > scaledOffsetEnd) {
          left2 = mid + 1;
        } else {
          result[offsetIndex] = mid;
          break;
        }
      }
    }
    return result;
  }
  function newRangeCount(prev, next) {
    return next.last - next.first + 1 - Math.max(0, 1 + Math.min(next.last, prev.last) - Math.max(next.first, prev.first));
  }
  function computeWindowedRenderLimits(props, maxToRenderPerBatch, windowSize, prev, getFrameMetricsApprox, scrollMetrics) {
    var itemCount = props.getItemCount(props.data);
    if (itemCount === 0) {
      return {
        first: 0,
        last: -1
      };
    }
    var offset = scrollMetrics.offset, velocity = scrollMetrics.velocity, visibleLength = scrollMetrics.visibleLength, _scrollMetrics$zoomSc = scrollMetrics.zoomScale, zoomScale = _scrollMetrics$zoomSc === void 0 ? 1 : _scrollMetrics$zoomSc;
    var visibleBegin = Math.max(0, offset);
    var visibleEnd = visibleBegin + visibleLength;
    var overscanLength = (windowSize - 1) * visibleLength;
    var leadFactor = 0.5;
    var fillPreference = velocity > 1 ? "after" : velocity < -1 ? "before" : "none";
    var overscanBegin = Math.max(0, visibleBegin - (1 - leadFactor) * overscanLength);
    var overscanEnd = Math.max(0, visibleEnd + leadFactor * overscanLength);
    var lastItemOffset = getFrameMetricsApprox(itemCount - 1, props).offset * zoomScale;
    if (lastItemOffset < overscanBegin) {
      return {
        first: Math.max(0, itemCount - 1 - maxToRenderPerBatch),
        last: itemCount - 1
      };
    }
    var _elementsThatOverlapO = elementsThatOverlapOffsets([overscanBegin, visibleBegin, visibleEnd, overscanEnd], props, getFrameMetricsApprox, zoomScale), overscanFirst = _elementsThatOverlapO[0], first = _elementsThatOverlapO[1], last = _elementsThatOverlapO[2], overscanLast = _elementsThatOverlapO[3];
    overscanFirst = overscanFirst == null ? 0 : overscanFirst;
    first = first == null ? Math.max(0, overscanFirst) : first;
    overscanLast = overscanLast == null ? itemCount - 1 : overscanLast;
    last = last == null ? Math.min(overscanLast, first + maxToRenderPerBatch - 1) : last;
    var visible = {
      first,
      last
    };
    var newCellCount = newRangeCount(prev, visible);
    while (true) {
      if (first <= overscanFirst && last >= overscanLast) {
        break;
      }
      var maxNewCells = newCellCount >= maxToRenderPerBatch;
      var firstWillAddMore = first <= prev.first || first > prev.last;
      var firstShouldIncrement = first > overscanFirst && (!maxNewCells || !firstWillAddMore);
      var lastWillAddMore = last >= prev.last || last < prev.first;
      var lastShouldIncrement = last < overscanLast && (!maxNewCells || !lastWillAddMore);
      if (maxNewCells && !firstShouldIncrement && !lastShouldIncrement) {
        break;
      }
      if (firstShouldIncrement && !(fillPreference === "after" && lastShouldIncrement && lastWillAddMore)) {
        if (firstWillAddMore) {
          newCellCount++;
        }
        first--;
      }
      if (lastShouldIncrement && !(fillPreference === "before" && firstShouldIncrement && firstWillAddMore)) {
        if (lastWillAddMore) {
          newCellCount++;
        }
        last++;
      }
    }
    if (!(last >= first && first >= 0 && last < itemCount && first >= overscanFirst && last <= overscanLast && first <= visible.first && last >= visible.last)) {
      throw new Error("Bad window calculation " + JSON.stringify({
        first,
        last,
        itemCount,
        overscanFirst,
        overscanLast,
        visible
      }));
    }
    return {
      first,
      last
    };
  }
  function keyExtractor(item, index) {
    if (typeof item === "object" && (item == null ? void 0 : item.key) != null) {
      return item.key;
    }
    if (typeof item === "object" && (item == null ? void 0 : item.id) != null) {
      return item.id;
    }
    return String(index);
  }

  // node_modules/react-native-web/dist/vendor/react-native/VirtualizedList/index.js
  var import_invariant10 = __toESM(require_invariant());
  var import_nullthrows = __toESM(require_nullthrows());
  var React14 = __toESM(require_react());
  var __DEV__3 = false;
  var ON_EDGE_REACHED_EPSILON = 1e-3;
  var _usedIndexForKey = false;
  var _keylessItemComponentName = "";
  function horizontalOrDefault(horizontal) {
    return horizontal !== null && horizontal !== void 0 ? horizontal : false;
  }
  function initialNumToRenderOrDefault(initialNumToRender) {
    return initialNumToRender !== null && initialNumToRender !== void 0 ? initialNumToRender : 10;
  }
  function maxToRenderPerBatchOrDefault(maxToRenderPerBatch) {
    return maxToRenderPerBatch !== null && maxToRenderPerBatch !== void 0 ? maxToRenderPerBatch : 10;
  }
  function onStartReachedThresholdOrDefault(onStartReachedThreshold) {
    return onStartReachedThreshold !== null && onStartReachedThreshold !== void 0 ? onStartReachedThreshold : 2;
  }
  function onEndReachedThresholdOrDefault(onEndReachedThreshold) {
    return onEndReachedThreshold !== null && onEndReachedThreshold !== void 0 ? onEndReachedThreshold : 2;
  }
  function getScrollingThreshold(threshold, visibleLength) {
    return threshold * visibleLength / 2;
  }
  function scrollEventThrottleOrDefault(scrollEventThrottle) {
    return scrollEventThrottle !== null && scrollEventThrottle !== void 0 ? scrollEventThrottle : 50;
  }
  function windowSizeOrDefault(windowSize) {
    return windowSize !== null && windowSize !== void 0 ? windowSize : 21;
  }
  function findLastWhere(arr, predicate) {
    for (var i = arr.length - 1; i >= 0; i--) {
      if (predicate(arr[i])) {
        return arr[i];
      }
    }
    return null;
  }
  var VirtualizedList = class _VirtualizedList extends StateSafePureComponent {
    // scrollToEnd may be janky without getItemLayout prop
    scrollToEnd(params) {
      var animated = params ? params.animated : true;
      var veryLast = this.props.getItemCount(this.props.data) - 1;
      if (veryLast < 0) {
        return;
      }
      var frame = this.__getFrameMetricsApprox(veryLast, this.props);
      var offset = Math.max(0, frame.offset + frame.length + this._footerLength - this._scrollMetrics.visibleLength);
      if (this._scrollRef == null) {
        return;
      }
      if (this._scrollRef.scrollTo == null) {
        console.warn("No scrollTo method provided. This may be because you have two nested VirtualizedLists with the same orientation, or because you are using a custom component that does not implement scrollTo.");
        return;
      }
      this._scrollRef.scrollTo(horizontalOrDefault(this.props.horizontal) ? {
        x: offset,
        animated
      } : {
        y: offset,
        animated
      });
    }
    // scrollToIndex may be janky without getItemLayout prop
    scrollToIndex(params) {
      var _this$props = this.props, data = _this$props.data, horizontal = _this$props.horizontal, getItemCount = _this$props.getItemCount, getItemLayout = _this$props.getItemLayout, onScrollToIndexFailed = _this$props.onScrollToIndexFailed;
      var animated = params.animated, index = params.index, viewOffset = params.viewOffset, viewPosition = params.viewPosition;
      (0, import_invariant10.default)(index >= 0, "scrollToIndex out of range: requested index " + index + " but minimum is 0");
      (0, import_invariant10.default)(getItemCount(data) >= 1, "scrollToIndex out of range: item length " + getItemCount(data) + " but minimum is 1");
      (0, import_invariant10.default)(index < getItemCount(data), "scrollToIndex out of range: requested index " + index + " is out of 0 to " + (getItemCount(data) - 1));
      if (!getItemLayout && index > this._highestMeasuredFrameIndex) {
        (0, import_invariant10.default)(!!onScrollToIndexFailed, "scrollToIndex should be used in conjunction with getItemLayout or onScrollToIndexFailed, otherwise there is no way to know the location of offscreen indices or handle failures.");
        onScrollToIndexFailed({
          averageItemLength: this._averageCellLength,
          highestMeasuredFrameIndex: this._highestMeasuredFrameIndex,
          index
        });
        return;
      }
      var frame = this.__getFrameMetricsApprox(Math.floor(index), this.props);
      var offset = Math.max(0, this._getOffsetApprox(index, this.props) - (viewPosition || 0) * (this._scrollMetrics.visibleLength - frame.length)) - (viewOffset || 0);
      if (this._scrollRef == null) {
        return;
      }
      if (this._scrollRef.scrollTo == null) {
        console.warn("No scrollTo method provided. This may be because you have two nested VirtualizedLists with the same orientation, or because you are using a custom component that does not implement scrollTo.");
        return;
      }
      this._scrollRef.scrollTo(horizontal ? {
        x: offset,
        animated
      } : {
        y: offset,
        animated
      });
    }
    // scrollToItem may be janky without getItemLayout prop. Required linear scan through items -
    // use scrollToIndex instead if possible.
    scrollToItem(params) {
      var item = params.item;
      var _this$props2 = this.props, data = _this$props2.data, getItem = _this$props2.getItem, getItemCount = _this$props2.getItemCount;
      var itemCount = getItemCount(data);
      for (var _index = 0; _index < itemCount; _index++) {
        if (getItem(data, _index) === item) {
          this.scrollToIndex(_objectSpread2(_objectSpread2({}, params), {}, {
            index: _index
          }));
          break;
        }
      }
    }
    /**
     * Scroll to a specific content pixel offset in the list.
     *
     * Param `offset` expects the offset to scroll to.
     * In case of `horizontal` is true, the offset is the x-value,
     * in any other case the offset is the y-value.
     *
     * Param `animated` (`true` by default) defines whether the list
     * should do an animation while scrolling.
     */
    scrollToOffset(params) {
      var animated = params.animated, offset = params.offset;
      if (this._scrollRef == null) {
        return;
      }
      if (this._scrollRef.scrollTo == null) {
        console.warn("No scrollTo method provided. This may be because you have two nested VirtualizedLists with the same orientation, or because you are using a custom component that does not implement scrollTo.");
        return;
      }
      this._scrollRef.scrollTo(horizontalOrDefault(this.props.horizontal) ? {
        x: offset,
        animated
      } : {
        y: offset,
        animated
      });
    }
    recordInteraction() {
      this._nestedChildLists.forEach((childList) => {
        childList.recordInteraction();
      });
      this._viewabilityTuples.forEach((t) => {
        t.viewabilityHelper.recordInteraction();
      });
      this._updateViewableItems(this.props, this.state.cellsAroundViewport);
    }
    flashScrollIndicators() {
      if (this._scrollRef == null) {
        return;
      }
      this._scrollRef.flashScrollIndicators();
    }
    /**
     * Provides a handle to the underlying scroll responder.
     * Note that `this._scrollRef` might not be a `ScrollView`, so we
     * need to check that it responds to `getScrollResponder` before calling it.
     */
    getScrollResponder() {
      if (this._scrollRef && this._scrollRef.getScrollResponder) {
        return this._scrollRef.getScrollResponder();
      }
    }
    getScrollableNode() {
      if (this._scrollRef && this._scrollRef.getScrollableNode) {
        return this._scrollRef.getScrollableNode();
      } else {
        return this._scrollRef;
      }
    }
    getScrollRef() {
      if (this._scrollRef && this._scrollRef.getScrollRef) {
        return this._scrollRef.getScrollRef();
      } else {
        return this._scrollRef;
      }
    }
    _getCellKey() {
      var _this$context;
      return ((_this$context = this.context) == null ? void 0 : _this$context.cellKey) || "rootList";
    }
    // $FlowFixMe[missing-local-annot]
    hasMore() {
      return this._hasMore;
    }
    // $FlowFixMe[missing-local-annot]
    // REACT-NATIVE-WEB patch to preserve during future RN merges: Support inverted wheel scroller.
    constructor(_props) {
      var _this$props$updateCel;
      super(_props);
      this._getScrollMetrics = () => {
        return this._scrollMetrics;
      };
      this._getOutermostParentListRef = () => {
        if (this._isNestedWithSameOrientation()) {
          return this.context.getOutermostParentListRef();
        } else {
          return this;
        }
      };
      this._registerAsNestedChild = (childList) => {
        this._nestedChildLists.add(childList.ref, childList.cellKey);
        if (this._hasInteracted) {
          childList.ref.recordInteraction();
        }
      };
      this._unregisterAsNestedChild = (childList) => {
        this._nestedChildLists.remove(childList.ref);
      };
      this._onUpdateSeparators = (keys, newProps) => {
        keys.forEach((key) => {
          var ref = key != null && this._cellRefs[key];
          ref && ref.updateSeparatorProps(newProps);
        });
      };
      this._getSpacerKey = (isVertical) => isVertical ? "height" : "width";
      this._averageCellLength = 0;
      this._cellRefs = {};
      this._frames = {};
      this._footerLength = 0;
      this._hasTriggeredInitialScrollToIndex = false;
      this._hasInteracted = false;
      this._hasMore = false;
      this._hasWarned = {};
      this._headerLength = 0;
      this._hiPriInProgress = false;
      this._highestMeasuredFrameIndex = 0;
      this._indicesToKeys = /* @__PURE__ */ new Map();
      this._lastFocusedCellKey = null;
      this._nestedChildLists = new ChildListCollection();
      this._offsetFromParentVirtualizedList = 0;
      this._prevParentOffset = 0;
      this._scrollMetrics = {
        contentLength: 0,
        dOffset: 0,
        dt: 10,
        offset: 0,
        timestamp: 0,
        velocity: 0,
        visibleLength: 0,
        zoomScale: 1
      };
      this._scrollRef = null;
      this._sentStartForContentLength = 0;
      this._sentEndForContentLength = 0;
      this._totalCellLength = 0;
      this._totalCellsMeasured = 0;
      this._viewabilityTuples = [];
      this._captureScrollRef = (ref) => {
        this._scrollRef = ref;
      };
      this._defaultRenderScrollComponent = (props) => {
        var onRefresh = props.onRefresh;
        if (this._isNestedWithSameOrientation()) {
          return /* @__PURE__ */ React14.createElement(View_default, props);
        } else if (onRefresh) {
          var _props$refreshing;
          (0, import_invariant10.default)(typeof props.refreshing === "boolean", "`refreshing` prop must be set as a boolean in order to use `onRefresh`, but got `" + JSON.stringify((_props$refreshing = props.refreshing) !== null && _props$refreshing !== void 0 ? _props$refreshing : "undefined") + "`");
          return (
            // $FlowFixMe[prop-missing] Invalid prop usage
            // $FlowFixMe[incompatible-use]
            /* @__PURE__ */ React14.createElement(ScrollView_default, _extends({}, props, {
              refreshControl: props.refreshControl == null ? /* @__PURE__ */ React14.createElement(
                RefreshControl_default,
                {
                  refreshing: props.refreshing,
                  onRefresh,
                  progressViewOffset: props.progressViewOffset
                }
              ) : props.refreshControl
            }))
          );
        } else {
          return /* @__PURE__ */ React14.createElement(ScrollView_default, props);
        }
      };
      this._onCellLayout = (e, cellKey, index) => {
        var layout = e.nativeEvent.layout;
        var next = {
          offset: this._selectOffset(layout),
          length: this._selectLength(layout),
          index,
          inLayout: true
        };
        var curr = this._frames[cellKey];
        if (!curr || next.offset !== curr.offset || next.length !== curr.length || index !== curr.index) {
          this._totalCellLength += next.length - (curr ? curr.length : 0);
          this._totalCellsMeasured += curr ? 0 : 1;
          this._averageCellLength = this._totalCellLength / this._totalCellsMeasured;
          this._frames[cellKey] = next;
          this._highestMeasuredFrameIndex = Math.max(this._highestMeasuredFrameIndex, index);
          this._scheduleCellsToRenderUpdate();
        } else {
          this._frames[cellKey].inLayout = true;
        }
        this._triggerRemeasureForChildListsInCell(cellKey);
        this._computeBlankness();
        this._updateViewableItems(this.props, this.state.cellsAroundViewport);
      };
      this._onCellUnmount = (cellKey) => {
        delete this._cellRefs[cellKey];
        var curr = this._frames[cellKey];
        if (curr) {
          this._frames[cellKey] = _objectSpread2(_objectSpread2({}, curr), {}, {
            inLayout: false
          });
        }
      };
      this._onLayout = (e) => {
        if (this._isNestedWithSameOrientation()) {
          this.measureLayoutRelativeToContainingList();
        } else {
          this._scrollMetrics.visibleLength = this._selectLength(e.nativeEvent.layout);
        }
        this.props.onLayout && this.props.onLayout(e);
        this._scheduleCellsToRenderUpdate();
        this._maybeCallOnEdgeReached();
      };
      this._onLayoutEmpty = (e) => {
        this.props.onLayout && this.props.onLayout(e);
      };
      this._onLayoutFooter = (e) => {
        this._triggerRemeasureForChildListsInCell(this._getFooterCellKey());
        this._footerLength = this._selectLength(e.nativeEvent.layout);
      };
      this._onLayoutHeader = (e) => {
        this._headerLength = this._selectLength(e.nativeEvent.layout);
      };
      this._onContentSizeChange = (width, height) => {
        if (width > 0 && height > 0 && this.props.initialScrollIndex != null && this.props.initialScrollIndex > 0 && !this._hasTriggeredInitialScrollToIndex) {
          if (this.props.contentOffset == null) {
            if (this.props.initialScrollIndex < this.props.getItemCount(this.props.data)) {
              this.scrollToIndex({
                animated: false,
                index: (0, import_nullthrows.default)(this.props.initialScrollIndex)
              });
            } else {
              this.scrollToEnd({
                animated: false
              });
            }
          }
          this._hasTriggeredInitialScrollToIndex = true;
        }
        if (this.props.onContentSizeChange) {
          this.props.onContentSizeChange(width, height);
        }
        this._scrollMetrics.contentLength = this._selectLength({
          height,
          width
        });
        this._scheduleCellsToRenderUpdate();
        this._maybeCallOnEdgeReached();
      };
      this._convertParentScrollMetrics = (metrics) => {
        var offset = metrics.offset - this._offsetFromParentVirtualizedList;
        var visibleLength = metrics.visibleLength;
        var dOffset = offset - this._scrollMetrics.offset;
        var contentLength = this._scrollMetrics.contentLength;
        return {
          visibleLength,
          contentLength,
          offset,
          dOffset
        };
      };
      this._onScroll = (e) => {
        this._nestedChildLists.forEach((childList) => {
          childList._onScroll(e);
        });
        if (this.props.onScroll) {
          this.props.onScroll(e);
        }
        var timestamp = e.timeStamp;
        var visibleLength = this._selectLength(e.nativeEvent.layoutMeasurement);
        var contentLength = this._selectLength(e.nativeEvent.contentSize);
        var offset = this._selectOffset(e.nativeEvent.contentOffset);
        var dOffset = offset - this._scrollMetrics.offset;
        if (this._isNestedWithSameOrientation()) {
          if (this._scrollMetrics.contentLength === 0) {
            return;
          }
          var _this$_convertParentS = this._convertParentScrollMetrics({
            visibleLength,
            offset
          });
          visibleLength = _this$_convertParentS.visibleLength;
          contentLength = _this$_convertParentS.contentLength;
          offset = _this$_convertParentS.offset;
          dOffset = _this$_convertParentS.dOffset;
        }
        var dt = this._scrollMetrics.timestamp ? Math.max(1, timestamp - this._scrollMetrics.timestamp) : 1;
        var velocity = dOffset / dt;
        if (dt > 500 && this._scrollMetrics.dt > 500 && contentLength > 5 * visibleLength && !this._hasWarned.perf) {
          infoLog_default("VirtualizedList: You have a large list that is slow to update - make sure your renderItem function renders components that follow React performance best practices like PureComponent, shouldComponentUpdate, etc.", {
            dt,
            prevDt: this._scrollMetrics.dt,
            contentLength
          });
          this._hasWarned.perf = true;
        }
        var zoomScale = e.nativeEvent.zoomScale < 0 ? 1 : e.nativeEvent.zoomScale;
        this._scrollMetrics = {
          contentLength,
          dt,
          dOffset,
          offset,
          timestamp,
          velocity,
          visibleLength,
          zoomScale
        };
        this._updateViewableItems(this.props, this.state.cellsAroundViewport);
        if (!this.props) {
          return;
        }
        this._maybeCallOnEdgeReached();
        if (velocity !== 0) {
          this._fillRateHelper.activate();
        }
        this._computeBlankness();
        this._scheduleCellsToRenderUpdate();
      };
      this._onScrollBeginDrag = (e) => {
        this._nestedChildLists.forEach((childList) => {
          childList._onScrollBeginDrag(e);
        });
        this._viewabilityTuples.forEach((tuple) => {
          tuple.viewabilityHelper.recordInteraction();
        });
        this._hasInteracted = true;
        this.props.onScrollBeginDrag && this.props.onScrollBeginDrag(e);
      };
      this._onScrollEndDrag = (e) => {
        this._nestedChildLists.forEach((childList) => {
          childList._onScrollEndDrag(e);
        });
        var velocity = e.nativeEvent.velocity;
        if (velocity) {
          this._scrollMetrics.velocity = this._selectOffset(velocity);
        }
        this._computeBlankness();
        this.props.onScrollEndDrag && this.props.onScrollEndDrag(e);
      };
      this._onMomentumScrollBegin = (e) => {
        this._nestedChildLists.forEach((childList) => {
          childList._onMomentumScrollBegin(e);
        });
        this.props.onMomentumScrollBegin && this.props.onMomentumScrollBegin(e);
      };
      this._onMomentumScrollEnd = (e) => {
        this._nestedChildLists.forEach((childList) => {
          childList._onMomentumScrollEnd(e);
        });
        this._scrollMetrics.velocity = 0;
        this._computeBlankness();
        this.props.onMomentumScrollEnd && this.props.onMomentumScrollEnd(e);
      };
      this._updateCellsToRender = () => {
        this._updateViewableItems(this.props, this.state.cellsAroundViewport);
        this.setState((state, props) => {
          var cellsAroundViewport = this._adjustCellsAroundViewport(props, state.cellsAroundViewport);
          var renderMask = _VirtualizedList._createRenderMask(props, cellsAroundViewport, this._getNonViewportRenderRegions(props));
          if (cellsAroundViewport.first === state.cellsAroundViewport.first && cellsAroundViewport.last === state.cellsAroundViewport.last && renderMask.equals(state.renderMask)) {
            return null;
          }
          return {
            cellsAroundViewport,
            renderMask
          };
        });
      };
      this._createViewToken = (index, isViewable, props) => {
        var data = props.data, getItem = props.getItem;
        var item = getItem(data, index);
        return {
          index,
          item,
          key: this._keyExtractor(item, index, props),
          isViewable
        };
      };
      this._getOffsetApprox = (index, props) => {
        if (Number.isInteger(index)) {
          return this.__getFrameMetricsApprox(index, props).offset;
        } else {
          var frameMetrics = this.__getFrameMetricsApprox(Math.floor(index), props);
          var remainder = index - Math.floor(index);
          return frameMetrics.offset + remainder * frameMetrics.length;
        }
      };
      this.__getFrameMetricsApprox = (index, props) => {
        var frame = this._getFrameMetrics(index, props);
        if (frame && frame.index === index) {
          return frame;
        } else {
          var data = props.data, getItemCount = props.getItemCount, getItemLayout = props.getItemLayout;
          (0, import_invariant10.default)(index >= 0 && index < getItemCount(data), "Tried to get frame for out of range index " + index);
          (0, import_invariant10.default)(!getItemLayout, "Should not have to estimate frames when a measurement metrics function is provided");
          return {
            length: this._averageCellLength,
            offset: this._averageCellLength * index
          };
        }
      };
      this._getFrameMetrics = (index, props) => {
        var data = props.data, getItem = props.getItem, getItemCount = props.getItemCount, getItemLayout = props.getItemLayout;
        (0, import_invariant10.default)(index >= 0 && index < getItemCount(data), "Tried to get frame for out of range index " + index);
        var item = getItem(data, index);
        var frame = this._frames[this._keyExtractor(item, index, props)];
        if (!frame || frame.index !== index) {
          if (getItemLayout) {
            return getItemLayout(data, index);
          }
        }
        return frame;
      };
      this._getNonViewportRenderRegions = (props) => {
        if (!(this._lastFocusedCellKey && this._cellRefs[this._lastFocusedCellKey])) {
          return [];
        }
        var lastFocusedCellRenderer = this._cellRefs[this._lastFocusedCellKey];
        var focusedCellIndex = lastFocusedCellRenderer.props.index;
        var itemCount = props.getItemCount(props.data);
        if (focusedCellIndex >= itemCount || this._keyExtractor(props.getItem(props.data, focusedCellIndex), focusedCellIndex, props) !== this._lastFocusedCellKey) {
          return [];
        }
        var first = focusedCellIndex;
        var heightOfCellsBeforeFocused = 0;
        for (var i = first - 1; i >= 0 && heightOfCellsBeforeFocused < this._scrollMetrics.visibleLength; i--) {
          first--;
          heightOfCellsBeforeFocused += this.__getFrameMetricsApprox(i, props).length;
        }
        var last = focusedCellIndex;
        var heightOfCellsAfterFocused = 0;
        for (var _i = last + 1; _i < itemCount && heightOfCellsAfterFocused < this._scrollMetrics.visibleLength; _i++) {
          last++;
          heightOfCellsAfterFocused += this.__getFrameMetricsApprox(_i, props).length;
        }
        return [{
          first,
          last
        }];
      };
      this._checkProps(_props);
      this._fillRateHelper = new FillRateHelper_default(this._getFrameMetrics);
      this._updateCellsToRenderBatcher = new Batchinator_default(this._updateCellsToRender, (_this$props$updateCel = this.props.updateCellsBatchingPeriod) !== null && _this$props$updateCel !== void 0 ? _this$props$updateCel : 50);
      if (this.props.viewabilityConfigCallbackPairs) {
        this._viewabilityTuples = this.props.viewabilityConfigCallbackPairs.map((pair) => ({
          viewabilityHelper: new ViewabilityHelper_default(pair.viewabilityConfig),
          onViewableItemsChanged: pair.onViewableItemsChanged
        }));
      } else {
        var _this$props3 = this.props, onViewableItemsChanged = _this$props3.onViewableItemsChanged, viewabilityConfig = _this$props3.viewabilityConfig;
        if (onViewableItemsChanged) {
          this._viewabilityTuples.push({
            viewabilityHelper: new ViewabilityHelper_default(viewabilityConfig),
            onViewableItemsChanged
          });
        }
      }
      var initialRenderRegion = _VirtualizedList._initialRenderRegion(_props);
      this.state = {
        cellsAroundViewport: initialRenderRegion,
        renderMask: _VirtualizedList._createRenderMask(_props, initialRenderRegion)
      };
      this.invertedWheelEventHandler = (ev) => {
        var scrollOffset = this.props.horizontal ? ev.target.scrollLeft : ev.target.scrollTop;
        var scrollLength = this.props.horizontal ? ev.target.scrollWidth : ev.target.scrollHeight;
        var clientLength = this.props.horizontal ? ev.target.clientWidth : ev.target.clientHeight;
        var isEventTargetScrollable = scrollLength > clientLength;
        var delta = this.props.horizontal ? ev.deltaX || ev.wheelDeltaX : ev.deltaY || ev.wheelDeltaY;
        var leftoverDelta = delta;
        if (isEventTargetScrollable) {
          leftoverDelta = delta < 0 ? Math.min(delta + scrollOffset, 0) : Math.max(delta - (scrollLength - clientLength - scrollOffset), 0);
        }
        var targetDelta = delta - leftoverDelta;
        if (this.props.inverted && this._scrollRef && this._scrollRef.getScrollableNode) {
          var node = this._scrollRef.getScrollableNode();
          if (this.props.horizontal) {
            ev.target.scrollLeft += targetDelta;
            var nextScrollLeft = node.scrollLeft - leftoverDelta;
            node.scrollLeft = !this.props.getItemLayout ? Math.min(nextScrollLeft, this._totalCellLength) : nextScrollLeft;
          } else {
            ev.target.scrollTop += targetDelta;
            var nextScrollTop = node.scrollTop - leftoverDelta;
            node.scrollTop = !this.props.getItemLayout ? Math.min(nextScrollTop, this._totalCellLength) : nextScrollTop;
          }
          ev.preventDefault();
        }
      };
    }
    _checkProps(props) {
      var onScroll = props.onScroll, windowSize = props.windowSize, getItemCount = props.getItemCount, data = props.data, initialScrollIndex = props.initialScrollIndex;
      (0, import_invariant10.default)(
        // $FlowFixMe[prop-missing]
        !onScroll || !onScroll.__isNative,
        "Components based on VirtualizedList must be wrapped with Animated.createAnimatedComponent to support native onScroll events with useNativeDriver"
      );
      (0, import_invariant10.default)(windowSizeOrDefault(windowSize) > 0, "VirtualizedList: The windowSize prop must be present and set to a value greater than 0.");
      (0, import_invariant10.default)(getItemCount, 'VirtualizedList: The "getItemCount" prop must be provided');
      var itemCount = getItemCount(data);
      if (initialScrollIndex != null && !this._hasTriggeredInitialScrollToIndex && (initialScrollIndex < 0 || itemCount > 0 && initialScrollIndex >= itemCount) && !this._hasWarned.initialScrollIndex) {
        console.warn('initialScrollIndex "' + initialScrollIndex + '" is not valid (list has ' + itemCount + " items)");
        this._hasWarned.initialScrollIndex = true;
      }
      if (__DEV__3 && !this._hasWarned.flexWrap) {
        var flatStyles = StyleSheet_default.flatten(this.props.contentContainerStyle);
        if (flatStyles != null && flatStyles.flexWrap === "wrap") {
          console.warn("`flexWrap: `wrap`` is not supported with the `VirtualizedList` components.Consider using `numColumns` with `FlatList` instead.");
          this._hasWarned.flexWrap = true;
        }
      }
    }
    static _createRenderMask(props, cellsAroundViewport, additionalRegions) {
      var itemCount = props.getItemCount(props.data);
      (0, import_invariant10.default)(cellsAroundViewport.first >= 0 && cellsAroundViewport.last >= cellsAroundViewport.first - 1 && cellsAroundViewport.last < itemCount, 'Invalid cells around viewport "[' + cellsAroundViewport.first + ", " + cellsAroundViewport.last + ']" was passed to VirtualizedList._createRenderMask');
      var renderMask = new CellRenderMask(itemCount);
      if (itemCount > 0) {
        var allRegions = [cellsAroundViewport, ...additionalRegions !== null && additionalRegions !== void 0 ? additionalRegions : []];
        for (var _i2 = 0, _allRegions = allRegions; _i2 < _allRegions.length; _i2++) {
          var region = _allRegions[_i2];
          renderMask.addCells(region);
        }
        if (props.initialScrollIndex == null || props.initialScrollIndex <= 0) {
          var initialRegion = _VirtualizedList._initialRenderRegion(props);
          renderMask.addCells(initialRegion);
        }
        var stickyIndicesSet = new Set(props.stickyHeaderIndices);
        _VirtualizedList._ensureClosestStickyHeader(props, stickyIndicesSet, renderMask, cellsAroundViewport.first);
      }
      return renderMask;
    }
    static _initialRenderRegion(props) {
      var _props$initialScrollI;
      var itemCount = props.getItemCount(props.data);
      var firstCellIndex = Math.max(0, Math.min(itemCount - 1, Math.floor((_props$initialScrollI = props.initialScrollIndex) !== null && _props$initialScrollI !== void 0 ? _props$initialScrollI : 0)));
      var lastCellIndex = Math.min(itemCount, firstCellIndex + initialNumToRenderOrDefault(props.initialNumToRender)) - 1;
      return {
        first: firstCellIndex,
        last: lastCellIndex
      };
    }
    static _ensureClosestStickyHeader(props, stickyIndicesSet, renderMask, cellIdx) {
      var stickyOffset = props.ListHeaderComponent ? 1 : 0;
      for (var itemIdx = cellIdx - 1; itemIdx >= 0; itemIdx--) {
        if (stickyIndicesSet.has(itemIdx + stickyOffset)) {
          renderMask.addCells({
            first: itemIdx,
            last: itemIdx
          });
          break;
        }
      }
    }
    _adjustCellsAroundViewport(props, cellsAroundViewport) {
      var data = props.data, getItemCount = props.getItemCount;
      var onEndReachedThreshold = onEndReachedThresholdOrDefault(props.onEndReachedThreshold);
      var _this$_scrollMetrics = this._scrollMetrics, contentLength = _this$_scrollMetrics.contentLength, offset = _this$_scrollMetrics.offset, visibleLength = _this$_scrollMetrics.visibleLength;
      var distanceFromEnd = contentLength - visibleLength - offset;
      if (visibleLength <= 0 || contentLength <= 0) {
        return cellsAroundViewport.last >= getItemCount(data) ? _VirtualizedList._constrainToItemCount(cellsAroundViewport, props) : cellsAroundViewport;
      }
      var newCellsAroundViewport;
      if (props.disableVirtualization) {
        var renderAhead = distanceFromEnd < onEndReachedThreshold * visibleLength ? maxToRenderPerBatchOrDefault(props.maxToRenderPerBatch) : 0;
        newCellsAroundViewport = {
          first: 0,
          last: Math.min(cellsAroundViewport.last + renderAhead, getItemCount(data) - 1)
        };
      } else {
        if (props.initialScrollIndex && !this._scrollMetrics.offset && Math.abs(distanceFromEnd) >= Number.EPSILON) {
          return cellsAroundViewport.last >= getItemCount(data) ? _VirtualizedList._constrainToItemCount(cellsAroundViewport, props) : cellsAroundViewport;
        }
        newCellsAroundViewport = computeWindowedRenderLimits(props, maxToRenderPerBatchOrDefault(props.maxToRenderPerBatch), windowSizeOrDefault(props.windowSize), cellsAroundViewport, this.__getFrameMetricsApprox, this._scrollMetrics);
        (0, import_invariant10.default)(newCellsAroundViewport.last < getItemCount(data), "computeWindowedRenderLimits() should return range in-bounds");
      }
      if (this._nestedChildLists.size() > 0) {
        var childIdx = this._findFirstChildWithMore(newCellsAroundViewport.first, newCellsAroundViewport.last);
        newCellsAroundViewport.last = childIdx !== null && childIdx !== void 0 ? childIdx : newCellsAroundViewport.last;
      }
      return newCellsAroundViewport;
    }
    _findFirstChildWithMore(first, last) {
      for (var ii = first; ii <= last; ii++) {
        var cellKeyForIndex = this._indicesToKeys.get(ii);
        if (cellKeyForIndex != null && this._nestedChildLists.anyInCell(cellKeyForIndex, (childList) => childList.hasMore())) {
          return ii;
        }
      }
      return null;
    }
    componentDidMount() {
      if (this._isNestedWithSameOrientation()) {
        this.context.registerAsNestedChild({
          ref: this,
          cellKey: this.context.cellKey
        });
      }
      this.setupWebWheelHandler();
    }
    componentWillUnmount() {
      if (this._isNestedWithSameOrientation()) {
        this.context.unregisterAsNestedChild({
          ref: this
        });
      }
      this._updateCellsToRenderBatcher.dispose({
        abort: true
      });
      this._viewabilityTuples.forEach((tuple) => {
        tuple.viewabilityHelper.dispose();
      });
      this._fillRateHelper.deactivateAndFlush();
      this.teardownWebWheelHandler();
    }
    // REACT-NATIVE-WEB patch to preserve during future RN merges: Support inverted wheel scroller.
    setupWebWheelHandler() {
      if (this._scrollRef && this._scrollRef.getScrollableNode) {
        this._scrollRef.getScrollableNode().addEventListener("wheel", this.invertedWheelEventHandler);
      } else {
        setTimeout(() => this.setupWebWheelHandler(), 50);
        return;
      }
    }
    // REACT-NATIVE-WEB patch to preserve during future RN merges: Support inverted wheel scroller.
    teardownWebWheelHandler() {
      if (this._scrollRef && this._scrollRef.getScrollableNode) {
        this._scrollRef.getScrollableNode().removeEventListener("wheel", this.invertedWheelEventHandler);
      }
    }
    static getDerivedStateFromProps(newProps, prevState) {
      var itemCount = newProps.getItemCount(newProps.data);
      if (itemCount === prevState.renderMask.numCells()) {
        return prevState;
      }
      var constrainedCells = _VirtualizedList._constrainToItemCount(prevState.cellsAroundViewport, newProps);
      return {
        cellsAroundViewport: constrainedCells,
        renderMask: _VirtualizedList._createRenderMask(newProps, constrainedCells)
      };
    }
    _pushCells(cells, stickyHeaderIndices, stickyIndicesFromProps, first, last, inversionStyle) {
      var _this = this;
      var _this$props4 = this.props, CellRendererComponent = _this$props4.CellRendererComponent, ItemSeparatorComponent = _this$props4.ItemSeparatorComponent, ListHeaderComponent = _this$props4.ListHeaderComponent, ListItemComponent = _this$props4.ListItemComponent, data = _this$props4.data, debug = _this$props4.debug, getItem = _this$props4.getItem, getItemCount = _this$props4.getItemCount, getItemLayout = _this$props4.getItemLayout, horizontal = _this$props4.horizontal, renderItem = _this$props4.renderItem;
      var stickyOffset = ListHeaderComponent ? 1 : 0;
      var end = getItemCount(data) - 1;
      var prevCellKey;
      last = Math.min(end, last);
      var _loop = function _loop2() {
        var item = getItem(data, ii);
        var key = _this._keyExtractor(item, ii, _this.props);
        _this._indicesToKeys.set(ii, key);
        if (stickyIndicesFromProps.has(ii + stickyOffset)) {
          stickyHeaderIndices.push(cells.length);
        }
        var shouldListenForLayout = getItemLayout == null || debug || _this._fillRateHelper.enabled();
        cells.push(/* @__PURE__ */ React14.createElement(CellRenderer, _extends({
          CellRendererComponent,
          ItemSeparatorComponent: ii < end ? ItemSeparatorComponent : void 0,
          ListItemComponent,
          cellKey: key,
          horizontal,
          index: ii,
          inversionStyle,
          item,
          key,
          prevCellKey,
          onUpdateSeparators: _this._onUpdateSeparators,
          onCellFocusCapture: (e) => _this._onCellFocusCapture(key),
          onUnmount: _this._onCellUnmount,
          ref: (_ref) => {
            _this._cellRefs[key] = _ref;
          },
          renderItem
        }, shouldListenForLayout && {
          onCellLayout: _this._onCellLayout
        })));
        prevCellKey = key;
      };
      for (var ii = first; ii <= last; ii++) {
        _loop();
      }
    }
    static _constrainToItemCount(cells, props) {
      var itemCount = props.getItemCount(props.data);
      var last = Math.min(itemCount - 1, cells.last);
      var maxToRenderPerBatch = maxToRenderPerBatchOrDefault(props.maxToRenderPerBatch);
      return {
        first: clamp_default(0, itemCount - 1 - maxToRenderPerBatch, cells.first),
        last
      };
    }
    _isNestedWithSameOrientation() {
      var nestedContext = this.context;
      return !!(nestedContext && !!nestedContext.horizontal === horizontalOrDefault(this.props.horizontal));
    }
    _keyExtractor(item, index, props) {
      if (props.keyExtractor != null) {
        return props.keyExtractor(item, index);
      }
      var key = keyExtractor(item, index);
      if (key === String(index)) {
        _usedIndexForKey = true;
        if (item.type && item.type.displayName) {
          _keylessItemComponentName = item.type.displayName;
        }
      }
      return key;
    }
    render() {
      this._checkProps(this.props);
      var _this$props5 = this.props, ListEmptyComponent = _this$props5.ListEmptyComponent, ListFooterComponent = _this$props5.ListFooterComponent, ListHeaderComponent = _this$props5.ListHeaderComponent;
      var _this$props6 = this.props, data = _this$props6.data, horizontal = _this$props6.horizontal;
      var inversionStyle = this.props.inverted ? horizontalOrDefault(this.props.horizontal) ? styles5.horizontallyInverted : styles5.verticallyInverted : null;
      var cells = [];
      var stickyIndicesFromProps = new Set(this.props.stickyHeaderIndices);
      var stickyHeaderIndices = [];
      if (ListHeaderComponent) {
        if (stickyIndicesFromProps.has(0)) {
          stickyHeaderIndices.push(0);
        }
        var _element = /* @__PURE__ */ React14.isValidElement(ListHeaderComponent) ? ListHeaderComponent : (
          // $FlowFixMe[not-a-component]
          // $FlowFixMe[incompatible-type-arg]
          /* @__PURE__ */ React14.createElement(ListHeaderComponent, null)
        );
        cells.push(/* @__PURE__ */ React14.createElement(VirtualizedListCellContextProvider, {
          cellKey: this._getCellKey() + "-header",
          key: "$header"
        }, /* @__PURE__ */ React14.createElement(
          View_default,
          {
            onLayout: this._onLayoutHeader,
            style: [inversionStyle, this.props.ListHeaderComponentStyle]
          },
          // $FlowFixMe[incompatible-type] - Typing ReactNativeComponent revealed errors
          _element
        )));
      }
      var itemCount = this.props.getItemCount(data);
      if (itemCount === 0 && ListEmptyComponent) {
        var _element2 = /* @__PURE__ */ React14.isValidElement(ListEmptyComponent) ? ListEmptyComponent : (
          // $FlowFixMe[not-a-component]
          // $FlowFixMe[incompatible-type-arg]
          /* @__PURE__ */ React14.createElement(ListEmptyComponent, null)
        );
        cells.push(/* @__PURE__ */ React14.createElement(VirtualizedListCellContextProvider, {
          cellKey: this._getCellKey() + "-empty",
          key: "$empty"
        }, /* @__PURE__ */ React14.cloneElement(_element2, {
          onLayout: (event) => {
            this._onLayoutEmpty(event);
            if (_element2.props.onLayout) {
              _element2.props.onLayout(event);
            }
          },
          style: [inversionStyle, _element2.props.style]
        })));
      }
      if (itemCount > 0) {
        _usedIndexForKey = false;
        _keylessItemComponentName = "";
        var spacerKey = this._getSpacerKey(!horizontal);
        var renderRegions = this.state.renderMask.enumerateRegions();
        var lastSpacer = findLastWhere(renderRegions, (r) => r.isSpacer);
        for (var _iterator = _createForOfIteratorHelperLoose(renderRegions), _step; !(_step = _iterator()).done; ) {
          var section = _step.value;
          if (section.isSpacer) {
            if (this.props.disableVirtualization) {
              continue;
            }
            var isLastSpacer = section === lastSpacer;
            var constrainToMeasured = isLastSpacer && !this.props.getItemLayout;
            var last = constrainToMeasured ? clamp_default(section.first - 1, section.last, this._highestMeasuredFrameIndex) : section.last;
            var firstMetrics = this.__getFrameMetricsApprox(section.first, this.props);
            var lastMetrics = this.__getFrameMetricsApprox(last, this.props);
            var spacerSize = lastMetrics.offset + lastMetrics.length - firstMetrics.offset;
            cells.push(/* @__PURE__ */ React14.createElement(View_default, {
              key: "$spacer-" + section.first,
              style: {
                [spacerKey]: spacerSize
              }
            }));
          } else {
            this._pushCells(cells, stickyHeaderIndices, stickyIndicesFromProps, section.first, section.last, inversionStyle);
          }
        }
        if (!this._hasWarned.keys && _usedIndexForKey) {
          console.warn("VirtualizedList: missing keys for items, make sure to specify a key or id property on each item or provide a custom keyExtractor.", _keylessItemComponentName);
          this._hasWarned.keys = true;
        }
      }
      if (ListFooterComponent) {
        var _element3 = /* @__PURE__ */ React14.isValidElement(ListFooterComponent) ? ListFooterComponent : (
          // $FlowFixMe[not-a-component]
          // $FlowFixMe[incompatible-type-arg]
          /* @__PURE__ */ React14.createElement(ListFooterComponent, null)
        );
        cells.push(/* @__PURE__ */ React14.createElement(VirtualizedListCellContextProvider, {
          cellKey: this._getFooterCellKey(),
          key: "$footer"
        }, /* @__PURE__ */ React14.createElement(
          View_default,
          {
            onLayout: this._onLayoutFooter,
            style: [inversionStyle, this.props.ListFooterComponentStyle]
          },
          // $FlowFixMe[incompatible-type] - Typing ReactNativeComponent revealed errors
          _element3
        )));
      }
      var scrollProps = _objectSpread2(_objectSpread2({}, this.props), {}, {
        onContentSizeChange: this._onContentSizeChange,
        onLayout: this._onLayout,
        onScroll: this._onScroll,
        onScrollBeginDrag: this._onScrollBeginDrag,
        onScrollEndDrag: this._onScrollEndDrag,
        onMomentumScrollBegin: this._onMomentumScrollBegin,
        onMomentumScrollEnd: this._onMomentumScrollEnd,
        scrollEventThrottle: scrollEventThrottleOrDefault(this.props.scrollEventThrottle),
        // TODO: Android support
        invertStickyHeaders: this.props.invertStickyHeaders !== void 0 ? this.props.invertStickyHeaders : this.props.inverted,
        stickyHeaderIndices,
        style: inversionStyle ? [inversionStyle, this.props.style] : this.props.style
      });
      this._hasMore = this.state.cellsAroundViewport.last < itemCount - 1;
      var innerRet = /* @__PURE__ */ React14.createElement(VirtualizedListContextProvider, {
        value: {
          cellKey: null,
          getScrollMetrics: this._getScrollMetrics,
          horizontal: horizontalOrDefault(this.props.horizontal),
          getOutermostParentListRef: this._getOutermostParentListRef,
          registerAsNestedChild: this._registerAsNestedChild,
          unregisterAsNestedChild: this._unregisterAsNestedChild
        }
      }, /* @__PURE__ */ React14.cloneElement((this.props.renderScrollComponent || this._defaultRenderScrollComponent)(scrollProps), {
        ref: this._captureScrollRef
      }, cells));
      var ret = innerRet;
      if (this.props.debug) {
        return /* @__PURE__ */ React14.createElement(View_default, {
          style: styles5.debug
        }, ret, this._renderDebugOverlay());
      } else {
        return ret;
      }
    }
    componentDidUpdate(prevProps) {
      var _this$props7 = this.props, data = _this$props7.data, extraData = _this$props7.extraData;
      if (data !== prevProps.data || extraData !== prevProps.extraData) {
        this._viewabilityTuples.forEach((tuple) => {
          tuple.viewabilityHelper.resetViewableIndices();
        });
      }
      var hiPriInProgress = this._hiPriInProgress;
      this._scheduleCellsToRenderUpdate();
      if (hiPriInProgress) {
        this._hiPriInProgress = false;
      }
    }
    // Used for preventing scrollToIndex from being called multiple times for initialScrollIndex
    // flag to prevent infinite hiPri cell limit update
    // $FlowFixMe[missing-local-annot]
    /* $FlowFixMe[missing-local-annot] The type annotation(s) required by Flow's
     * LTI update could not be added via codemod */
    _computeBlankness() {
      this._fillRateHelper.computeBlankness(this.props, this.state.cellsAroundViewport, this._scrollMetrics);
    }
    /* $FlowFixMe[missing-local-annot] The type annotation(s) required by Flow's
     * LTI update could not be added via codemod */
    _onCellFocusCapture(cellKey) {
      this._lastFocusedCellKey = cellKey;
      this._updateCellsToRender();
    }
    _triggerRemeasureForChildListsInCell(cellKey) {
      this._nestedChildLists.forEachInCell(cellKey, (childList) => {
        childList.measureLayoutRelativeToContainingList();
      });
    }
    measureLayoutRelativeToContainingList() {
      try {
        if (!this._scrollRef) {
          return;
        }
        this._scrollRef.measureLayout(this.context.getOutermostParentListRef().getScrollRef(), (x, y, width, height) => {
          this._offsetFromParentVirtualizedList = this._selectOffset({
            x,
            y
          });
          this._scrollMetrics.contentLength = this._selectLength({
            width,
            height
          });
          var scrollMetrics = this._convertParentScrollMetrics(this.context.getScrollMetrics());
          var metricsChanged = this._scrollMetrics.visibleLength !== scrollMetrics.visibleLength || this._scrollMetrics.offset !== scrollMetrics.offset;
          if (metricsChanged) {
            this._scrollMetrics.visibleLength = scrollMetrics.visibleLength;
            this._scrollMetrics.offset = scrollMetrics.offset;
            this._nestedChildLists.forEach((childList) => {
              childList.measureLayoutRelativeToContainingList();
            });
          }
        }, (error) => {
          console.warn("VirtualizedList: Encountered an error while measuring a list's offset from its containing VirtualizedList.");
        });
      } catch (error) {
        console.warn("measureLayoutRelativeToContainingList threw an error", error.stack);
      }
    }
    _getFooterCellKey() {
      return this._getCellKey() + "-footer";
    }
    // $FlowFixMe[missing-local-annot]
    _renderDebugOverlay() {
      var normalize = this._scrollMetrics.visibleLength / (this._scrollMetrics.contentLength || 1);
      var framesInLayout = [];
      var itemCount = this.props.getItemCount(this.props.data);
      for (var ii = 0; ii < itemCount; ii++) {
        var frame = this.__getFrameMetricsApprox(ii, this.props);
        if (frame.inLayout) {
          framesInLayout.push(frame);
        }
      }
      var windowTop = this.__getFrameMetricsApprox(this.state.cellsAroundViewport.first, this.props).offset;
      var frameLast = this.__getFrameMetricsApprox(this.state.cellsAroundViewport.last, this.props);
      var windowLen = frameLast.offset + frameLast.length - windowTop;
      var visTop = this._scrollMetrics.offset;
      var visLen = this._scrollMetrics.visibleLength;
      return /* @__PURE__ */ React14.createElement(View_default, {
        style: [styles5.debugOverlayBase, styles5.debugOverlay]
      }, framesInLayout.map((f, ii2) => /* @__PURE__ */ React14.createElement(View_default, {
        key: "f" + ii2,
        style: [styles5.debugOverlayBase, styles5.debugOverlayFrame, {
          top: f.offset * normalize,
          height: f.length * normalize
        }]
      })), /* @__PURE__ */ React14.createElement(View_default, {
        style: [styles5.debugOverlayBase, styles5.debugOverlayFrameLast, {
          top: windowTop * normalize,
          height: windowLen * normalize
        }]
      }), /* @__PURE__ */ React14.createElement(View_default, {
        style: [styles5.debugOverlayBase, styles5.debugOverlayFrameVis, {
          top: visTop * normalize,
          height: visLen * normalize
        }]
      }));
    }
    _selectLength(metrics) {
      return !horizontalOrDefault(this.props.horizontal) ? metrics.height : metrics.width;
    }
    _selectOffset(metrics) {
      return !horizontalOrDefault(this.props.horizontal) ? metrics.y : metrics.x;
    }
    _maybeCallOnEdgeReached() {
      var _this$props8 = this.props, data = _this$props8.data, getItemCount = _this$props8.getItemCount, onStartReached = _this$props8.onStartReached, onStartReachedThreshold = _this$props8.onStartReachedThreshold, onEndReached = _this$props8.onEndReached, onEndReachedThreshold = _this$props8.onEndReachedThreshold, initialScrollIndex = _this$props8.initialScrollIndex;
      var _this$_scrollMetrics2 = this._scrollMetrics, contentLength = _this$_scrollMetrics2.contentLength, visibleLength = _this$_scrollMetrics2.visibleLength, offset = _this$_scrollMetrics2.offset;
      var distanceFromStart = offset;
      var distanceFromEnd = contentLength - visibleLength - offset;
      if (distanceFromStart < ON_EDGE_REACHED_EPSILON) {
        distanceFromStart = 0;
      }
      if (distanceFromEnd < ON_EDGE_REACHED_EPSILON) {
        distanceFromEnd = 0;
      }
      var DEFAULT_THRESHOLD_PX = 2;
      var startThreshold = onStartReachedThreshold != null ? onStartReachedThreshold * visibleLength : DEFAULT_THRESHOLD_PX;
      var endThreshold = onEndReachedThreshold != null ? onEndReachedThreshold * visibleLength : DEFAULT_THRESHOLD_PX;
      var isWithinStartThreshold = distanceFromStart <= startThreshold;
      var isWithinEndThreshold = distanceFromEnd <= endThreshold;
      if (onEndReached && this.state.cellsAroundViewport.last === getItemCount(data) - 1 && isWithinEndThreshold && this._scrollMetrics.contentLength !== this._sentEndForContentLength) {
        this._sentEndForContentLength = this._scrollMetrics.contentLength;
        onEndReached({
          distanceFromEnd
        });
      } else if (onStartReached != null && this.state.cellsAroundViewport.first === 0 && isWithinStartThreshold && this._scrollMetrics.contentLength !== this._sentStartForContentLength) {
        if (!initialScrollIndex || this._scrollMetrics.timestamp !== 0) {
          this._sentStartForContentLength = this._scrollMetrics.contentLength;
          onStartReached({
            distanceFromStart
          });
        }
      } else {
        this._sentStartForContentLength = isWithinStartThreshold ? this._sentStartForContentLength : 0;
        this._sentEndForContentLength = isWithinEndThreshold ? this._sentEndForContentLength : 0;
      }
    }
    /* Translates metrics from a scroll event in a parent VirtualizedList into
     * coordinates relative to the child list.
     */
    _scheduleCellsToRenderUpdate() {
      var _this$state$cellsArou = this.state.cellsAroundViewport, first = _this$state$cellsArou.first, last = _this$state$cellsArou.last;
      var _this$_scrollMetrics3 = this._scrollMetrics, offset = _this$_scrollMetrics3.offset, visibleLength = _this$_scrollMetrics3.visibleLength, velocity = _this$_scrollMetrics3.velocity;
      var itemCount = this.props.getItemCount(this.props.data);
      var hiPri = false;
      var onStartReachedThreshold = onStartReachedThresholdOrDefault(this.props.onStartReachedThreshold);
      var onEndReachedThreshold = onEndReachedThresholdOrDefault(this.props.onEndReachedThreshold);
      if (first > 0) {
        var distTop = offset - this.__getFrameMetricsApprox(first, this.props).offset;
        hiPri = distTop < 0 || velocity < -2 && distTop < getScrollingThreshold(onStartReachedThreshold, visibleLength);
      }
      if (!hiPri && last >= 0 && last < itemCount - 1) {
        var distBottom = this.__getFrameMetricsApprox(last, this.props).offset - (offset + visibleLength);
        hiPri = distBottom < 0 || velocity > 2 && distBottom < getScrollingThreshold(onEndReachedThreshold, visibleLength);
      }
      if (hiPri && (this._averageCellLength || this.props.getItemLayout) && !this._hiPriInProgress) {
        this._hiPriInProgress = true;
        this._updateCellsToRenderBatcher.dispose({
          abort: true
        });
        this._updateCellsToRender();
        return;
      } else {
        this._updateCellsToRenderBatcher.schedule();
      }
    }
    /**
     * Gets an approximate offset to an item at a given index. Supports
     * fractional indices.
     */
    _updateViewableItems(props, cellsAroundViewport) {
      this._viewabilityTuples.forEach((tuple) => {
        tuple.viewabilityHelper.onUpdate(props, this._scrollMetrics.offset, this._scrollMetrics.visibleLength, this._getFrameMetrics, this._createViewToken, tuple.onViewableItemsChanged, cellsAroundViewport);
      });
    }
  };
  VirtualizedList.contextType = VirtualizedListContext;
  var styles5 = StyleSheet_default.create({
    verticallyInverted: {
      transform: "scaleY(-1)"
    },
    horizontallyInverted: {
      transform: "scaleX(-1)"
    },
    debug: {
      flex: 1
    },
    debugOverlayBase: {
      position: "absolute",
      top: 0,
      right: 0
    },
    debugOverlay: {
      bottom: 0,
      width: 20,
      borderColor: "blue",
      borderWidth: 1
    },
    debugOverlayFrame: {
      left: 0,
      backgroundColor: "orange"
    },
    debugOverlayFrameLast: {
      left: 0,
      borderColor: "green",
      borderWidth: 2
    },
    debugOverlayFrameVis: {
      left: 0,
      borderColor: "red",
      borderWidth: 2
    }
  });
  var VirtualizedList_default = VirtualizedList;

  // node_modules/react-native-web/node_modules/memoize-one/dist/memoize-one.esm.js
  var safeIsNaN = Number.isNaN || function ponyfill(value) {
    return typeof value === "number" && value !== value;
  };
  function isEqual(first, second) {
    if (first === second) {
      return true;
    }
    if (safeIsNaN(first) && safeIsNaN(second)) {
      return true;
    }
    return false;
  }
  function areInputsEqual(newInputs, lastInputs) {
    if (newInputs.length !== lastInputs.length) {
      return false;
    }
    for (var i = 0; i < newInputs.length; i++) {
      if (!isEqual(newInputs[i], lastInputs[i])) {
        return false;
      }
    }
    return true;
  }
  function memoizeOne(resultFn, isEqual2) {
    if (isEqual2 === void 0) {
      isEqual2 = areInputsEqual;
    }
    var cache4 = null;
    function memoized() {
      var newArgs = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        newArgs[_i] = arguments[_i];
      }
      if (cache4 && cache4.lastThis === this && isEqual2(newArgs, cache4.lastArgs)) {
        return cache4.lastResult;
      }
      var lastResult = resultFn.apply(this, newArgs);
      cache4 = {
        lastResult,
        lastArgs: newArgs,
        lastThis: this
      };
      return lastResult;
    }
    memoized.clear = function clear() {
      cache4 = null;
    };
    return memoized;
  }

  // node_modules/react-native-web/dist/vendor/react-native/FlatList/index.js
  var _excluded8 = ["numColumns", "columnWrapperStyle", "removeClippedSubviews", "strictMode"];
  function removeClippedSubviewsOrDefault(removeClippedSubviews) {
    return removeClippedSubviews !== null && removeClippedSubviews !== void 0 ? removeClippedSubviews : Platform_default.OS === "android";
  }
  function numColumnsOrDefault(numColumns) {
    return numColumns !== null && numColumns !== void 0 ? numColumns : 1;
  }
  function isArrayLike(data) {
    return typeof Object(data).length === "number";
  }
  var FlatList = class extends React15.PureComponent {
    /**
     * Scrolls to the end of the content. May be janky without `getItemLayout` prop.
     */
    scrollToEnd(params) {
      if (this._listRef) {
        this._listRef.scrollToEnd(params);
      }
    }
    /**
     * Scrolls to the item at the specified index such that it is positioned in the viewable area
     * such that `viewPosition` 0 places it at the top, 1 at the bottom, and 0.5 centered in the
     * middle. `viewOffset` is a fixed number of pixels to offset the final target position.
     *
     * Note: cannot scroll to locations outside the render window without specifying the
     * `getItemLayout` prop.
     */
    scrollToIndex(params) {
      if (this._listRef) {
        this._listRef.scrollToIndex(params);
      }
    }
    /**
     * Requires linear scan through data - use `scrollToIndex` instead if possible.
     *
     * Note: cannot scroll to locations outside the render window without specifying the
     * `getItemLayout` prop.
     */
    scrollToItem(params) {
      if (this._listRef) {
        this._listRef.scrollToItem(params);
      }
    }
    /**
     * Scroll to a specific content pixel offset in the list.
     *
     * Check out [scrollToOffset](docs/virtualizedlist.html#scrolltooffset) of VirtualizedList
     */
    scrollToOffset(params) {
      if (this._listRef) {
        this._listRef.scrollToOffset(params);
      }
    }
    /**
     * Tells the list an interaction has occurred, which should trigger viewability calculations, e.g.
     * if `waitForInteractions` is true and the user has not scrolled. This is typically called by
     * taps on items or by navigation actions.
     */
    recordInteraction() {
      if (this._listRef) {
        this._listRef.recordInteraction();
      }
    }
    /**
     * Displays the scroll indicators momentarily.
     *
     * @platform ios
     */
    flashScrollIndicators() {
      if (this._listRef) {
        this._listRef.flashScrollIndicators();
      }
    }
    /**
     * Provides a handle to the underlying scroll responder.
     */
    getScrollResponder() {
      if (this._listRef) {
        return this._listRef.getScrollResponder();
      }
    }
    /**
     * Provides a reference to the underlying host component
     */
    getNativeScrollRef() {
      if (this._listRef) {
        return this._listRef.getScrollRef();
      }
    }
    getScrollableNode() {
      if (this._listRef) {
        return this._listRef.getScrollableNode();
      }
    }
    constructor(_props) {
      super(_props);
      this._virtualizedListPairs = [];
      this._captureRef = (ref) => {
        this._listRef = ref;
      };
      this._getItem = (data, index) => {
        var numColumns = numColumnsOrDefault(this.props.numColumns);
        if (numColumns > 1) {
          var ret = [];
          for (var kk = 0; kk < numColumns; kk++) {
            var itemIndex = index * numColumns + kk;
            if (itemIndex < data.length) {
              var _item = data[itemIndex];
              ret.push(_item);
            }
          }
          return ret;
        } else {
          return data[index];
        }
      };
      this._getItemCount = (data) => {
        if (data != null && isArrayLike(data)) {
          var numColumns = numColumnsOrDefault(this.props.numColumns);
          return numColumns > 1 ? Math.ceil(data.length / numColumns) : data.length;
        } else {
          return 0;
        }
      };
      this._keyExtractor = (items, index) => {
        var _this$props$keyExtrac;
        var numColumns = numColumnsOrDefault(this.props.numColumns);
        var keyExtractor2 = (_this$props$keyExtrac = this.props.keyExtractor) !== null && _this$props$keyExtrac !== void 0 ? _this$props$keyExtrac : keyExtractor;
        if (numColumns > 1) {
          (0, import_invariant11.default)(Array.isArray(items), "FlatList: Encountered internal consistency error, expected each item to consist of an array with 1-%s columns; instead, received a single item.", numColumns);
          return items.map((item, kk) => keyExtractor2(item, index * numColumns + kk)).join(":");
        }
        return keyExtractor2(items, index);
      };
      this._renderer = (ListItemComponent, renderItem, columnWrapperStyle, numColumns, extraData) => {
        var cols = numColumnsOrDefault(numColumns);
        var render = (props) => {
          if (ListItemComponent) {
            return /* @__PURE__ */ React15.createElement(ListItemComponent, props);
          } else if (renderItem) {
            return renderItem(props);
          } else {
            return null;
          }
        };
        var renderProp = (info) => {
          if (cols > 1) {
            var _item2 = info.item, _index = info.index;
            (0, import_invariant11.default)(Array.isArray(_item2), "Expected array of items with numColumns > 1");
            return /* @__PURE__ */ React15.createElement(View_default, {
              style: [styles6.row, columnWrapperStyle]
            }, _item2.map((it, kk) => {
              var element = render({
                // $FlowFixMe[incompatible-call]
                item: it,
                index: _index * cols + kk,
                separators: info.separators
              });
              return element != null ? /* @__PURE__ */ React15.createElement(React15.Fragment, {
                key: kk
              }, element) : null;
            }));
          } else {
            return render(info);
          }
        };
        return ListItemComponent ? {
          ListItemComponent: renderProp
        } : {
          renderItem: renderProp
        };
      };
      this._memoizedRenderer = memoizeOne(this._renderer);
      this._checkProps(this.props);
      if (this.props.viewabilityConfigCallbackPairs) {
        this._virtualizedListPairs = this.props.viewabilityConfigCallbackPairs.map((pair) => ({
          viewabilityConfig: pair.viewabilityConfig,
          onViewableItemsChanged: this._createOnViewableItemsChanged(pair.onViewableItemsChanged)
        }));
      } else if (this.props.onViewableItemsChanged) {
        this._virtualizedListPairs.push({
          /* $FlowFixMe[incompatible-call] (>=0.63.0 site=react_native_fb) This
           * comment suppresses an error found when Flow v0.63 was deployed. To
           * see the error delete this comment and run Flow. */
          viewabilityConfig: this.props.viewabilityConfig,
          onViewableItemsChanged: this._createOnViewableItemsChanged(this.props.onViewableItemsChanged)
        });
      }
    }
    // $FlowFixMe[missing-local-annot]
    componentDidUpdate(prevProps) {
      (0, import_invariant11.default)(prevProps.numColumns === this.props.numColumns, "Changing numColumns on the fly is not supported. Change the key prop on FlatList when changing the number of columns to force a fresh render of the component.");
      (0, import_invariant11.default)(prevProps.onViewableItemsChanged === this.props.onViewableItemsChanged, "Changing onViewableItemsChanged on the fly is not supported");
      (0, import_invariant11.default)(!deepDiffer_default(prevProps.viewabilityConfig, this.props.viewabilityConfig), "Changing viewabilityConfig on the fly is not supported");
      (0, import_invariant11.default)(prevProps.viewabilityConfigCallbackPairs === this.props.viewabilityConfigCallbackPairs, "Changing viewabilityConfigCallbackPairs on the fly is not supported");
      this._checkProps(this.props);
    }
    // $FlowFixMe[missing-local-annot]
    _checkProps(props) {
      var getItem = props.getItem, getItemCount = props.getItemCount, horizontal = props.horizontal, columnWrapperStyle = props.columnWrapperStyle, onViewableItemsChanged = props.onViewableItemsChanged, viewabilityConfigCallbackPairs = props.viewabilityConfigCallbackPairs;
      var numColumns = numColumnsOrDefault(this.props.numColumns);
      (0, import_invariant11.default)(!getItem && !getItemCount, "FlatList does not support custom data formats.");
      if (numColumns > 1) {
        (0, import_invariant11.default)(!horizontal, "numColumns does not support horizontal.");
      } else {
        (0, import_invariant11.default)(!columnWrapperStyle, "columnWrapperStyle not supported for single column lists");
      }
      (0, import_invariant11.default)(!(onViewableItemsChanged && viewabilityConfigCallbackPairs), "FlatList does not support setting both onViewableItemsChanged and viewabilityConfigCallbackPairs.");
    }
    _pushMultiColumnViewable(arr, v) {
      var _this$props$keyExtrac2;
      var numColumns = numColumnsOrDefault(this.props.numColumns);
      var keyExtractor2 = (_this$props$keyExtrac2 = this.props.keyExtractor) !== null && _this$props$keyExtrac2 !== void 0 ? _this$props$keyExtrac2 : keyExtractor;
      v.item.forEach((item, ii) => {
        (0, import_invariant11.default)(v.index != null, "Missing index!");
        var index = v.index * numColumns + ii;
        arr.push(_objectSpread2(_objectSpread2({}, v), {}, {
          item,
          key: keyExtractor2(item, index),
          index
        }));
      });
    }
    _createOnViewableItemsChanged(onViewableItemsChanged) {
      return (info) => {
        var numColumns = numColumnsOrDefault(this.props.numColumns);
        if (onViewableItemsChanged) {
          if (numColumns > 1) {
            var changed = [];
            var viewableItems = [];
            info.viewableItems.forEach((v) => this._pushMultiColumnViewable(viewableItems, v));
            info.changed.forEach((v) => this._pushMultiColumnViewable(changed, v));
            onViewableItemsChanged({
              viewableItems,
              changed
            });
          } else {
            onViewableItemsChanged(info);
          }
        }
      };
    }
    // $FlowFixMe[missing-local-annot]
    render() {
      var _this$props = this.props, numColumns = _this$props.numColumns, columnWrapperStyle = _this$props.columnWrapperStyle, _removeClippedSubviews = _this$props.removeClippedSubviews, _this$props$strictMod = _this$props.strictMode, strictMode = _this$props$strictMod === void 0 ? false : _this$props$strictMod, restProps = _objectWithoutPropertiesLoose(_this$props, _excluded8);
      var renderer = strictMode ? this._memoizedRenderer : this._renderer;
      return (
        // $FlowFixMe[incompatible-exact] - `restProps` (`Props`) is inexact.
        /* @__PURE__ */ React15.createElement(VirtualizedList_default, _extends({}, restProps, {
          getItem: this._getItem,
          getItemCount: this._getItemCount,
          keyExtractor: this._keyExtractor,
          ref: this._captureRef,
          viewabilityConfigCallbackPairs: this._virtualizedListPairs,
          removeClippedSubviews: removeClippedSubviewsOrDefault(_removeClippedSubviews)
        }, renderer(this.props.ListItemComponent, this.props.renderItem, columnWrapperStyle, numColumns, this.props.extraData)))
      );
    }
  };
  var styles6 = StyleSheet_default.create({
    row: {
      flexDirection: "row"
    }
  });
  var FlatList_default = FlatList;

  // node_modules/react-native-web/dist/exports/FlatList/index.js
  var FlatList_default2 = FlatList_default;

  // node_modules/react-native-web/dist/exports/Text/index.js
  var React16 = __toESM(require_react());
  var _excluded9 = ["hrefAttrs", "numberOfLines", "onClick", "onLayout", "onPress", "onMoveShouldSetResponder", "onMoveShouldSetResponderCapture", "onResponderEnd", "onResponderGrant", "onResponderMove", "onResponderReject", "onResponderRelease", "onResponderStart", "onResponderTerminate", "onResponderTerminationRequest", "onScrollShouldSetResponder", "onScrollShouldSetResponderCapture", "onSelectionChangeShouldSetResponder", "onSelectionChangeShouldSetResponderCapture", "onStartShouldSetResponder", "onStartShouldSetResponderCapture", "selectable"];
  var forwardPropsList2 = Object.assign({}, defaultProps, accessibilityProps, clickProps, focusProps, keyboardProps, mouseProps, touchProps, styleProps, {
    href: true,
    lang: true,
    pointerEvents: true
  });
  var pickProps2 = (props) => pick(props, forwardPropsList2);
  var Text = /* @__PURE__ */ React16.forwardRef((props, forwardedRef) => {
    var hrefAttrs = props.hrefAttrs, numberOfLines = props.numberOfLines, onClick = props.onClick, onLayout = props.onLayout, onPress = props.onPress, onMoveShouldSetResponder = props.onMoveShouldSetResponder, onMoveShouldSetResponderCapture = props.onMoveShouldSetResponderCapture, onResponderEnd = props.onResponderEnd, onResponderGrant = props.onResponderGrant, onResponderMove = props.onResponderMove, onResponderReject = props.onResponderReject, onResponderRelease = props.onResponderRelease, onResponderStart = props.onResponderStart, onResponderTerminate = props.onResponderTerminate, onResponderTerminationRequest = props.onResponderTerminationRequest, onScrollShouldSetResponder = props.onScrollShouldSetResponder, onScrollShouldSetResponderCapture = props.onScrollShouldSetResponderCapture, onSelectionChangeShouldSetResponder = props.onSelectionChangeShouldSetResponder, onSelectionChangeShouldSetResponderCapture = props.onSelectionChangeShouldSetResponderCapture, onStartShouldSetResponder = props.onStartShouldSetResponder, onStartShouldSetResponderCapture = props.onStartShouldSetResponderCapture, selectable = props.selectable, rest = _objectWithoutPropertiesLoose(props, _excluded9);
    var hasTextAncestor = React16.useContext(TextAncestorContext_default);
    var hostRef = React16.useRef(null);
    var _useLocaleContext = useLocaleContext(), contextDirection = _useLocaleContext.direction;
    useElementLayout(hostRef, onLayout);
    useResponderEvents(hostRef, {
      onMoveShouldSetResponder,
      onMoveShouldSetResponderCapture,
      onResponderEnd,
      onResponderGrant,
      onResponderMove,
      onResponderReject,
      onResponderRelease,
      onResponderStart,
      onResponderTerminate,
      onResponderTerminationRequest,
      onScrollShouldSetResponder,
      onScrollShouldSetResponderCapture,
      onSelectionChangeShouldSetResponder,
      onSelectionChangeShouldSetResponderCapture,
      onStartShouldSetResponder,
      onStartShouldSetResponderCapture
    });
    var handleClick = React16.useCallback((e) => {
      if (onClick != null) {
        onClick(e);
      } else if (onPress != null) {
        e.stopPropagation();
        onPress(e);
      }
    }, [onClick, onPress]);
    var component = hasTextAncestor ? "span" : "div";
    var langDirection = props.lang != null ? getLocaleDirection(props.lang) : null;
    var componentDirection = props.dir || langDirection;
    var writingDirection = componentDirection || contextDirection;
    var supportedProps = pickProps2(rest);
    supportedProps.dir = componentDirection;
    if (!hasTextAncestor) {
      supportedProps.dir = componentDirection != null ? componentDirection : "auto";
    }
    if (onClick || onPress) {
      supportedProps.onClick = handleClick;
    }
    supportedProps.style = [numberOfLines != null && numberOfLines > 1 && {
      WebkitLineClamp: numberOfLines
    }, hasTextAncestor === true ? styles7.textHasAncestor$raw : styles7.text$raw, numberOfLines === 1 && styles7.textOneLine, numberOfLines != null && numberOfLines > 1 && styles7.textMultiLine, props.style, selectable === true && styles7.selectable, selectable === false && styles7.notSelectable, onPress && styles7.pressable];
    if (props.href != null) {
      component = "a";
      if (hrefAttrs != null) {
        var download = hrefAttrs.download, rel = hrefAttrs.rel, target = hrefAttrs.target;
        if (download != null) {
          supportedProps.download = download;
        }
        if (rel != null) {
          supportedProps.rel = rel;
        }
        if (typeof target === "string") {
          supportedProps.target = target.charAt(0) !== "_" ? "_" + target : target;
        }
      }
    }
    var platformMethodsRef = usePlatformMethods(supportedProps);
    var setRef = useMergeRefs(hostRef, platformMethodsRef, forwardedRef);
    supportedProps.ref = setRef;
    var element = createElement_default(component, supportedProps, {
      writingDirection
    });
    return hasTextAncestor ? element : /* @__PURE__ */ React16.createElement(TextAncestorContext_default.Provider, {
      value: true
    }, element);
  });
  Text.displayName = "Text";
  var textStyle = {
    backgroundColor: "transparent",
    border: "0 solid black",
    boxSizing: "border-box",
    color: "black",
    display: "inline",
    font: "14px System",
    listStyle: "none",
    margin: 0,
    padding: 0,
    position: "relative",
    textAlign: "start",
    textDecoration: "none",
    whiteSpace: "pre-wrap",
    wordWrap: "break-word"
  };
  var styles7 = StyleSheet_default.create({
    text$raw: textStyle,
    textHasAncestor$raw: _objectSpread2(_objectSpread2({}, textStyle), {}, {
      color: "inherit",
      font: "inherit",
      textAlign: "inherit",
      whiteSpace: "inherit"
    }),
    textOneLine: {
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      wordWrap: "normal"
    },
    // See #13
    textMultiLine: {
      display: "-webkit-box",
      maxWidth: "100%",
      overflow: "clip",
      textOverflow: "ellipsis",
      WebkitBoxOrient: "vertical"
    },
    notSelectable: {
      userSelect: "none"
    },
    selectable: {
      userSelect: "text"
    },
    pressable: {
      cursor: "pointer"
    }
  });
  var Text_default = Text;

  // node_modules/react-native-web/dist/exports/ActivityIndicator/index.js
  var React17 = __toESM(require_react());
  var _excluded10 = ["animating", "color", "hidesWhenStopped", "size", "style"];
  var createSvgCircle = (style) => /* @__PURE__ */ React17.createElement("circle", {
    cx: "16",
    cy: "16",
    fill: "none",
    r: "14",
    strokeWidth: "4",
    style
  });
  var ActivityIndicator = /* @__PURE__ */ React17.forwardRef((props, forwardedRef) => {
    var _props$animating = props.animating, animating = _props$animating === void 0 ? true : _props$animating, _props$color = props.color, color = _props$color === void 0 ? "#1976D2" : _props$color, _props$hidesWhenStopp = props.hidesWhenStopped, hidesWhenStopped = _props$hidesWhenStopp === void 0 ? true : _props$hidesWhenStopp, _props$size = props.size, size = _props$size === void 0 ? "small" : _props$size, style = props.style, other = _objectWithoutPropertiesLoose(props, _excluded10);
    var svg = /* @__PURE__ */ React17.createElement("svg", {
      height: "100%",
      viewBox: "0 0 32 32",
      width: "100%"
    }, createSvgCircle({
      stroke: color,
      opacity: 0.2
    }), createSvgCircle({
      stroke: color,
      strokeDasharray: 80,
      strokeDashoffset: 60
    }));
    return /* @__PURE__ */ React17.createElement(View_default, _extends({}, other, {
      "aria-valuemax": 1,
      "aria-valuemin": 0,
      ref: forwardedRef,
      role: "progressbar",
      style: [styles8.container, style]
    }), /* @__PURE__ */ React17.createElement(View_default, {
      children: svg,
      style: [typeof size === "number" ? {
        height: size,
        width: size
      } : indicatorSizes[size], styles8.animation, !animating && styles8.animationPause, !animating && hidesWhenStopped && styles8.hidesWhenStopped]
    }));
  });
  ActivityIndicator.displayName = "ActivityIndicator";
  var styles8 = StyleSheet_default.create({
    container: {
      alignItems: "center",
      justifyContent: "center"
    },
    hidesWhenStopped: {
      visibility: "hidden"
    },
    animation: {
      animationDuration: "0.75s",
      animationKeyframes: [{
        "0%": {
          transform: "rotate(0deg)"
        },
        "100%": {
          transform: "rotate(360deg)"
        }
      }],
      animationTimingFunction: "linear",
      animationIterationCount: "infinite"
    },
    animationPause: {
      animationPlayState: "paused"
    }
  });
  var indicatorSizes = StyleSheet_default.create({
    small: {
      width: 20,
      height: 20
    },
    large: {
      width: 36,
      height: 36
    }
  });
  var ActivityIndicator_default = ActivityIndicator;

  // node_modules/react-native-web/dist/exports/TouchableOpacity/index.js
  var React18 = __toESM(require_react());
  var import_react9 = __toESM(require_react());

  // node_modules/react-native-web/dist/modules/usePressEvents/PressResponder.js
  var DELAY = "DELAY";
  var ERROR = "ERROR";
  var LONG_PRESS_DETECTED = "LONG_PRESS_DETECTED";
  var NOT_RESPONDER = "NOT_RESPONDER";
  var RESPONDER_ACTIVE_LONG_PRESS_START = "RESPONDER_ACTIVE_LONG_PRESS_START";
  var RESPONDER_ACTIVE_PRESS_START = "RESPONDER_ACTIVE_PRESS_START";
  var RESPONDER_INACTIVE_PRESS_START = "RESPONDER_INACTIVE_PRESS_START";
  var RESPONDER_GRANT = "RESPONDER_GRANT";
  var RESPONDER_RELEASE = "RESPONDER_RELEASE";
  var RESPONDER_TERMINATED = "RESPONDER_TERMINATED";
  var Transitions = Object.freeze({
    NOT_RESPONDER: {
      DELAY: ERROR,
      RESPONDER_GRANT: RESPONDER_INACTIVE_PRESS_START,
      RESPONDER_RELEASE: ERROR,
      RESPONDER_TERMINATED: ERROR,
      LONG_PRESS_DETECTED: ERROR
    },
    RESPONDER_INACTIVE_PRESS_START: {
      DELAY: RESPONDER_ACTIVE_PRESS_START,
      RESPONDER_GRANT: ERROR,
      RESPONDER_RELEASE: NOT_RESPONDER,
      RESPONDER_TERMINATED: NOT_RESPONDER,
      LONG_PRESS_DETECTED: ERROR
    },
    RESPONDER_ACTIVE_PRESS_START: {
      DELAY: ERROR,
      RESPONDER_GRANT: ERROR,
      RESPONDER_RELEASE: NOT_RESPONDER,
      RESPONDER_TERMINATED: NOT_RESPONDER,
      LONG_PRESS_DETECTED: RESPONDER_ACTIVE_LONG_PRESS_START
    },
    RESPONDER_ACTIVE_LONG_PRESS_START: {
      DELAY: ERROR,
      RESPONDER_GRANT: ERROR,
      RESPONDER_RELEASE: NOT_RESPONDER,
      RESPONDER_TERMINATED: NOT_RESPONDER,
      LONG_PRESS_DETECTED: RESPONDER_ACTIVE_LONG_PRESS_START
    },
    ERROR: {
      DELAY: NOT_RESPONDER,
      RESPONDER_GRANT: RESPONDER_INACTIVE_PRESS_START,
      RESPONDER_RELEASE: NOT_RESPONDER,
      RESPONDER_TERMINATED: NOT_RESPONDER,
      LONG_PRESS_DETECTED: NOT_RESPONDER
    }
  });
  var getElementRole = (element) => element.getAttribute("role");
  var getElementType = (element) => element.tagName.toLowerCase();
  var isActiveSignal = (signal) => signal === RESPONDER_ACTIVE_PRESS_START || signal === RESPONDER_ACTIVE_LONG_PRESS_START;
  var isButtonRole = (element) => getElementRole(element) === "button";
  var isPressStartSignal = (signal) => signal === RESPONDER_INACTIVE_PRESS_START || signal === RESPONDER_ACTIVE_PRESS_START || signal === RESPONDER_ACTIVE_LONG_PRESS_START;
  var isTerminalSignal = (signal) => signal === RESPONDER_TERMINATED || signal === RESPONDER_RELEASE;
  var isValidKeyPress = (event) => {
    var key = event.key, target = event.target;
    var isSpacebar = key === " " || key === "Spacebar";
    var isButtonish = getElementType(target) === "button" || isButtonRole(target);
    return key === "Enter" || isSpacebar && isButtonish;
  };
  var DEFAULT_LONG_PRESS_DELAY_MS = 450;
  var DEFAULT_PRESS_DELAY_MS = 50;
  var PressResponder = class {
    constructor(config) {
      this._eventHandlers = null;
      this._isPointerTouch = false;
      this._longPressDelayTimeout = null;
      this._longPressDispatched = false;
      this._pressDelayTimeout = null;
      this._pressOutDelayTimeout = null;
      this._touchState = NOT_RESPONDER;
      this._responderElement = null;
      this.configure(config);
    }
    configure(config) {
      this._config = config;
    }
    /**
     * Resets any pending timers. This should be called on unmount.
     */
    reset() {
      this._cancelLongPressDelayTimeout();
      this._cancelPressDelayTimeout();
      this._cancelPressOutDelayTimeout();
    }
    /**
     * Returns a set of props to spread into the interactive element.
     */
    getEventHandlers() {
      if (this._eventHandlers == null) {
        this._eventHandlers = this._createEventHandlers();
      }
      return this._eventHandlers;
    }
    _createEventHandlers() {
      var start = (event, shouldDelay) => {
        event.persist();
        this._cancelPressOutDelayTimeout();
        this._longPressDispatched = false;
        this._selectionTerminated = false;
        this._touchState = NOT_RESPONDER;
        this._isPointerTouch = event.nativeEvent.type === "touchstart";
        this._receiveSignal(RESPONDER_GRANT, event);
        var delayPressStart = normalizeDelay(this._config.delayPressStart, 0, DEFAULT_PRESS_DELAY_MS);
        if (shouldDelay !== false && delayPressStart > 0) {
          this._pressDelayTimeout = setTimeout(() => {
            this._receiveSignal(DELAY, event);
          }, delayPressStart);
        } else {
          this._receiveSignal(DELAY, event);
        }
        var delayLongPress = normalizeDelay(this._config.delayLongPress, 10, DEFAULT_LONG_PRESS_DELAY_MS);
        this._longPressDelayTimeout = setTimeout(() => {
          this._handleLongPress(event);
        }, delayLongPress + delayPressStart);
      };
      var end = (event) => {
        this._receiveSignal(RESPONDER_RELEASE, event);
      };
      var keyupHandler = (event) => {
        var onPress = this._config.onPress;
        var target = event.target;
        if (this._touchState !== NOT_RESPONDER && isValidKeyPress(event)) {
          end(event);
          document.removeEventListener("keyup", keyupHandler);
          var role = target.getAttribute("role");
          var elementType = getElementType(target);
          var isNativeInteractiveElement = role === "link" || elementType === "a" || elementType === "button" || elementType === "input" || elementType === "select" || elementType === "textarea";
          var isActiveElement = this._responderElement === target;
          if (onPress != null && !isNativeInteractiveElement && isActiveElement) {
            onPress(event);
          }
          this._responderElement = null;
        }
      };
      return {
        onStartShouldSetResponder: (event) => {
          var disabled = this._config.disabled;
          if (disabled && isButtonRole(event.currentTarget)) {
            event.stopPropagation();
          }
          if (disabled == null) {
            return true;
          }
          return !disabled;
        },
        onKeyDown: (event) => {
          var disabled = this._config.disabled;
          var key = event.key, target = event.target;
          if (!disabled && isValidKeyPress(event)) {
            if (this._touchState === NOT_RESPONDER) {
              start(event, false);
              this._responderElement = target;
              document.addEventListener("keyup", keyupHandler);
            }
            var isSpacebarKey = key === " " || key === "Spacebar";
            var role = getElementRole(target);
            var isButtonLikeRole = role === "button" || role === "menuitem";
            if (isSpacebarKey && isButtonLikeRole && getElementType(target) !== "button") {
              event.preventDefault();
            }
            event.stopPropagation();
          }
        },
        onResponderGrant: (event) => start(event),
        onResponderMove: (event) => {
          if (this._config.onPressMove != null) {
            this._config.onPressMove(event);
          }
          var touch = getTouchFromResponderEvent(event);
          if (this._touchActivatePosition != null) {
            var deltaX = this._touchActivatePosition.pageX - touch.pageX;
            var deltaY = this._touchActivatePosition.pageY - touch.pageY;
            if (Math.hypot(deltaX, deltaY) > 10) {
              this._cancelLongPressDelayTimeout();
            }
          }
        },
        onResponderRelease: (event) => end(event),
        onResponderTerminate: (event) => {
          if (event.nativeEvent.type === "selectionchange") {
            this._selectionTerminated = true;
          }
          this._receiveSignal(RESPONDER_TERMINATED, event);
        },
        onResponderTerminationRequest: (event) => {
          var _this$_config = this._config, cancelable = _this$_config.cancelable, disabled = _this$_config.disabled, onLongPress = _this$_config.onLongPress;
          if (!disabled && onLongPress != null && this._isPointerTouch && event.nativeEvent.type === "contextmenu") {
            return false;
          }
          if (cancelable == null) {
            return true;
          }
          return cancelable;
        },
        // NOTE: this diverges from react-native in 3 significant ways:
        // * The `onPress` callback is not connected to the responder system (the native
        //  `click` event must be used but is dispatched in many scenarios where no pointers
        //   are on the screen.) Therefore, it's possible for `onPress` to be called without
        //   `onPress{Start,End}` being called first.
        // * The `onPress` callback is only be called on the first ancestor of the native
        //   `click` target that is using the PressResponder.
        // * The event's `nativeEvent` is a `MouseEvent` not a `TouchEvent`.
        onClick: (event) => {
          var _this$_config2 = this._config, disabled = _this$_config2.disabled, onPress = _this$_config2.onPress;
          if (!disabled) {
            event.stopPropagation();
            if (this._longPressDispatched || this._selectionTerminated) {
              event.preventDefault();
            } else if (onPress != null && event.altKey === false) {
              onPress(event);
            }
          } else {
            if (isButtonRole(event.currentTarget)) {
              event.stopPropagation();
            }
          }
        },
        // If `onLongPress` is provided and a touch pointer is being used, prevent the
        // default context menu from opening.
        onContextMenu: (event) => {
          var _this$_config3 = this._config, disabled = _this$_config3.disabled, onLongPress = _this$_config3.onLongPress;
          if (!disabled) {
            if (onLongPress != null && this._isPointerTouch && !event.defaultPrevented) {
              event.preventDefault();
              event.stopPropagation();
            }
          } else {
            if (isButtonRole(event.currentTarget)) {
              event.stopPropagation();
            }
          }
        }
      };
    }
    /**
     * Receives a state machine signal, performs side effects of the transition
     * and stores the new state. Validates the transition as well.
     */
    _receiveSignal(signal, event) {
      var prevState = this._touchState;
      var nextState = null;
      if (Transitions[prevState] != null) {
        nextState = Transitions[prevState][signal];
      }
      if (this._touchState === NOT_RESPONDER && signal === RESPONDER_RELEASE) {
        return;
      }
      if (nextState == null || nextState === ERROR) {
        console.error("PressResponder: Invalid signal " + signal + " for state " + prevState + " on responder");
      } else if (prevState !== nextState) {
        this._performTransitionSideEffects(prevState, nextState, signal, event);
        this._touchState = nextState;
      }
    }
    /**
     * Performs a transition between touchable states and identify any activations
     * or deactivations (and callback invocations).
     */
    _performTransitionSideEffects(prevState, nextState, signal, event) {
      if (isTerminalSignal(signal)) {
        setTimeout(() => {
          this._isPointerTouch = false;
        }, 0);
        this._touchActivatePosition = null;
        this._cancelLongPressDelayTimeout();
      }
      if (isPressStartSignal(prevState) && signal === LONG_PRESS_DETECTED) {
        var onLongPress = this._config.onLongPress;
        if (onLongPress != null && event.nativeEvent.key == null) {
          onLongPress(event);
          this._longPressDispatched = true;
        }
      }
      var isPrevActive = isActiveSignal(prevState);
      var isNextActive = isActiveSignal(nextState);
      if (!isPrevActive && isNextActive) {
        this._activate(event);
      } else if (isPrevActive && !isNextActive) {
        this._deactivate(event);
      }
      if (isPressStartSignal(prevState) && signal === RESPONDER_RELEASE) {
        var _this$_config4 = this._config, _onLongPress = _this$_config4.onLongPress, onPress = _this$_config4.onPress;
        if (onPress != null) {
          var isPressCanceledByLongPress = _onLongPress != null && prevState === RESPONDER_ACTIVE_LONG_PRESS_START;
          if (!isPressCanceledByLongPress) {
            if (!isNextActive && !isPrevActive) {
              this._activate(event);
              this._deactivate(event);
            }
          }
        }
      }
      this._cancelPressDelayTimeout();
    }
    _activate(event) {
      var _this$_config5 = this._config, onPressChange = _this$_config5.onPressChange, onPressStart = _this$_config5.onPressStart;
      var touch = getTouchFromResponderEvent(event);
      this._touchActivatePosition = {
        pageX: touch.pageX,
        pageY: touch.pageY
      };
      if (onPressStart != null) {
        onPressStart(event);
      }
      if (onPressChange != null) {
        onPressChange(true);
      }
    }
    _deactivate(event) {
      var _this$_config6 = this._config, onPressChange = _this$_config6.onPressChange, onPressEnd = _this$_config6.onPressEnd;
      function end() {
        if (onPressEnd != null) {
          onPressEnd(event);
        }
        if (onPressChange != null) {
          onPressChange(false);
        }
      }
      var delayPressEnd = normalizeDelay(this._config.delayPressEnd);
      if (delayPressEnd > 0) {
        this._pressOutDelayTimeout = setTimeout(() => {
          end();
        }, delayPressEnd);
      } else {
        end();
      }
    }
    _handleLongPress(event) {
      if (this._touchState === RESPONDER_ACTIVE_PRESS_START || this._touchState === RESPONDER_ACTIVE_LONG_PRESS_START) {
        this._receiveSignal(LONG_PRESS_DETECTED, event);
      }
    }
    _cancelLongPressDelayTimeout() {
      if (this._longPressDelayTimeout != null) {
        clearTimeout(this._longPressDelayTimeout);
        this._longPressDelayTimeout = null;
      }
    }
    _cancelPressDelayTimeout() {
      if (this._pressDelayTimeout != null) {
        clearTimeout(this._pressDelayTimeout);
        this._pressDelayTimeout = null;
      }
    }
    _cancelPressOutDelayTimeout() {
      if (this._pressOutDelayTimeout != null) {
        clearTimeout(this._pressOutDelayTimeout);
        this._pressOutDelayTimeout = null;
      }
    }
  };
  function normalizeDelay(delay, min, fallback) {
    if (min === void 0) {
      min = 0;
    }
    if (fallback === void 0) {
      fallback = 0;
    }
    return Math.max(min, delay !== null && delay !== void 0 ? delay : fallback);
  }
  function getTouchFromResponderEvent(event) {
    var _event$nativeEvent = event.nativeEvent, changedTouches = _event$nativeEvent.changedTouches, touches = _event$nativeEvent.touches;
    if (touches != null && touches.length > 0) {
      return touches[0];
    }
    if (changedTouches != null && changedTouches.length > 0) {
      return changedTouches[0];
    }
    return event.nativeEvent;
  }

  // node_modules/react-native-web/dist/modules/usePressEvents/index.js
  var import_react8 = __toESM(require_react());
  function usePressEvents(hostRef, config) {
    var pressResponderRef = (0, import_react8.useRef)(null);
    if (pressResponderRef.current == null) {
      pressResponderRef.current = new PressResponder(config);
    }
    var pressResponder = pressResponderRef.current;
    (0, import_react8.useEffect)(() => {
      pressResponder.configure(config);
    }, [config, pressResponder]);
    (0, import_react8.useEffect)(() => {
      return () => {
        pressResponder.reset();
      };
    }, [pressResponder]);
    (0, import_react8.useDebugValue)(config);
    return pressResponder.getEventHandlers();
  }

  // node_modules/react-native-web/dist/exports/TouchableOpacity/index.js
  var _excluded11 = ["activeOpacity", "delayPressIn", "delayPressOut", "delayLongPress", "disabled", "focusable", "onLongPress", "onPress", "onPressIn", "onPressOut", "rejectResponderTermination", "style"];
  function TouchableOpacity(props, forwardedRef) {
    var activeOpacity = props.activeOpacity, delayPressIn = props.delayPressIn, delayPressOut = props.delayPressOut, delayLongPress = props.delayLongPress, disabled = props.disabled, focusable = props.focusable, onLongPress = props.onLongPress, onPress = props.onPress, onPressIn = props.onPressIn, onPressOut = props.onPressOut, rejectResponderTermination = props.rejectResponderTermination, style = props.style, rest = _objectWithoutPropertiesLoose(props, _excluded11);
    var hostRef = (0, import_react9.useRef)(null);
    var setRef = useMergeRefs(forwardedRef, hostRef);
    var _useState = (0, import_react9.useState)("0s"), duration = _useState[0], setDuration = _useState[1];
    var _useState2 = (0, import_react9.useState)(null), opacityOverride = _useState2[0], setOpacityOverride = _useState2[1];
    var setOpacityTo = (0, import_react9.useCallback)((value, duration2) => {
      setOpacityOverride(value);
      setDuration(duration2 ? duration2 / 1e3 + "s" : "0s");
    }, [setOpacityOverride, setDuration]);
    var setOpacityActive = (0, import_react9.useCallback)((duration2) => {
      setOpacityTo(activeOpacity !== null && activeOpacity !== void 0 ? activeOpacity : 0.2, duration2);
    }, [activeOpacity, setOpacityTo]);
    var setOpacityInactive = (0, import_react9.useCallback)((duration2) => {
      setOpacityTo(null, duration2);
    }, [setOpacityTo]);
    var pressConfig = (0, import_react9.useMemo)(() => ({
      cancelable: !rejectResponderTermination,
      disabled,
      delayLongPress,
      delayPressStart: delayPressIn,
      delayPressEnd: delayPressOut,
      onLongPress,
      onPress,
      onPressStart(event) {
        var isGrant = event.dispatchConfig != null ? event.dispatchConfig.registrationName === "onResponderGrant" : event.type === "keydown";
        setOpacityActive(isGrant ? 0 : 150);
        if (onPressIn != null) {
          onPressIn(event);
        }
      },
      onPressEnd(event) {
        setOpacityInactive(250);
        if (onPressOut != null) {
          onPressOut(event);
        }
      }
    }), [delayLongPress, delayPressIn, delayPressOut, disabled, onLongPress, onPress, onPressIn, onPressOut, rejectResponderTermination, setOpacityActive, setOpacityInactive]);
    var pressEventHandlers = usePressEvents(hostRef, pressConfig);
    return /* @__PURE__ */ React18.createElement(View_default, _extends({}, rest, pressEventHandlers, {
      accessibilityDisabled: disabled,
      focusable: !disabled && focusable !== false,
      pointerEvents: disabled ? "box-none" : void 0,
      ref: setRef,
      style: [styles9.root, !disabled && styles9.actionable, style, opacityOverride != null && {
        opacity: opacityOverride
      }, {
        transitionDuration: duration
      }]
    }));
  }
  var styles9 = StyleSheet_default.create({
    root: {
      transitionProperty: "opacity",
      transitionDuration: "0.15s",
      userSelect: "none"
    },
    actionable: {
      cursor: "pointer",
      touchAction: "manipulation"
    }
  });
  var MemoedTouchableOpacity = /* @__PURE__ */ React18.memo(/* @__PURE__ */ React18.forwardRef(TouchableOpacity));
  MemoedTouchableOpacity.displayName = "TouchableOpacity";
  var TouchableOpacity_default = MemoedTouchableOpacity;

  // node_modules/react-native-web/dist/exports/Modal/index.js
  var React23 = __toESM(require_react());

  // node_modules/react-native-web/dist/exports/Modal/ModalPortal.js
  var React19 = __toESM(require_react());
  var import_react_dom = __toESM(require_react_dom());
  function ModalPortal(props) {
    var children = props.children;
    var elementRef = React19.useRef(null);
    if (canUseDom_default && !elementRef.current) {
      var element = document.createElement("div");
      if (element && document.body) {
        document.body.appendChild(element);
        elementRef.current = element;
      }
    }
    React19.useEffect(() => {
      if (canUseDom_default) {
        return () => {
          if (document.body && elementRef.current) {
            document.body.removeChild(elementRef.current);
            elementRef.current = null;
          }
        };
      }
    }, []);
    return elementRef.current && canUseDom_default ? /* @__PURE__ */ (0, import_react_dom.createPortal)(children, elementRef.current) : null;
  }
  var ModalPortal_default = ModalPortal;

  // node_modules/react-native-web/dist/exports/Modal/ModalAnimation.js
  var React20 = __toESM(require_react());
  var ANIMATION_DURATION = 250;
  function getAnimationStyle(animationType, visible) {
    if (animationType === "slide") {
      return visible ? animatedSlideInStyles : animatedSlideOutStyles;
    }
    if (animationType === "fade") {
      return visible ? animatedFadeInStyles : animatedFadeOutStyles;
    }
    return visible ? styles10.container : styles10.hidden;
  }
  function ModalAnimation(props) {
    var animationType = props.animationType, children = props.children, onDismiss = props.onDismiss, onShow = props.onShow, visible = props.visible;
    var _React$useState = React20.useState(false), isRendering = _React$useState[0], setIsRendering = _React$useState[1];
    var wasVisible = React20.useRef(false);
    var wasRendering = React20.useRef(false);
    var isAnimated = animationType && animationType !== "none";
    var animationEndCallback = React20.useCallback((e) => {
      if (e && e.currentTarget !== e.target) {
        return;
      }
      if (visible) {
        if (onShow) {
          onShow();
        }
      } else {
        setIsRendering(false);
      }
    }, [onShow, visible]);
    React20.useEffect(() => {
      if (wasRendering.current && !isRendering && onDismiss) {
        onDismiss();
      }
      wasRendering.current = isRendering;
    }, [isRendering, onDismiss]);
    React20.useEffect(() => {
      if (visible) {
        setIsRendering(true);
      }
      if (visible !== wasVisible.current && !isAnimated) {
        animationEndCallback();
      }
      wasVisible.current = visible;
    }, [isAnimated, visible, animationEndCallback]);
    return isRendering || visible ? createElement_default("div", {
      style: isRendering ? getAnimationStyle(animationType, visible) : styles10.hidden,
      onAnimationEnd: animationEndCallback,
      children
    }) : null;
  }
  var styles10 = StyleSheet_default.create({
    container: {
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 9999
    },
    animatedIn: {
      animationDuration: ANIMATION_DURATION + "ms",
      animationTimingFunction: "cubic-bezier(0.215, 0.61, 0.355, 1)"
    },
    animatedOut: {
      pointerEvents: "none",
      animationDuration: ANIMATION_DURATION + "ms",
      animationTimingFunction: "cubic-bezier(0.47, 0, 0.745, 0.715)"
    },
    fadeIn: {
      opacity: 1,
      animationKeyframes: {
        "0%": {
          opacity: 0
        },
        "100%": {
          opacity: 1
        }
      }
    },
    fadeOut: {
      opacity: 0,
      animationKeyframes: {
        "0%": {
          opacity: 1
        },
        "100%": {
          opacity: 0
        }
      }
    },
    slideIn: {
      transform: "translateY(0%)",
      animationKeyframes: {
        "0%": {
          transform: "translateY(100%)"
        },
        "100%": {
          transform: "translateY(0%)"
        }
      }
    },
    slideOut: {
      transform: "translateY(100%)",
      animationKeyframes: {
        "0%": {
          transform: "translateY(0%)"
        },
        "100%": {
          transform: "translateY(100%)"
        }
      }
    },
    hidden: {
      opacity: 0
    }
  });
  var animatedSlideInStyles = [styles10.container, styles10.animatedIn, styles10.slideIn];
  var animatedSlideOutStyles = [styles10.container, styles10.animatedOut, styles10.slideOut];
  var animatedFadeInStyles = [styles10.container, styles10.animatedIn, styles10.fadeIn];
  var animatedFadeOutStyles = [styles10.container, styles10.animatedOut, styles10.fadeOut];
  var ModalAnimation_default = ModalAnimation;

  // node_modules/react-native-web/dist/exports/Modal/ModalContent.js
  var React21 = __toESM(require_react());
  var _excluded12 = ["active", "children", "onRequestClose", "transparent"];
  var ModalContent = /* @__PURE__ */ React21.forwardRef((props, forwardedRef) => {
    var active = props.active, children = props.children, onRequestClose = props.onRequestClose, transparent = props.transparent, rest = _objectWithoutPropertiesLoose(props, _excluded12);
    React21.useEffect(() => {
      if (canUseDom_default) {
        var closeOnEscape = (e) => {
          if (active && e.key === "Escape") {
            e.stopPropagation();
            if (onRequestClose) {
              onRequestClose();
            }
          }
        };
        document.addEventListener("keyup", closeOnEscape, false);
        return () => document.removeEventListener("keyup", closeOnEscape, false);
      }
    }, [active, onRequestClose]);
    var style = React21.useMemo(() => {
      return [styles11.modal, transparent ? styles11.modalTransparent : styles11.modalOpaque];
    }, [transparent]);
    return /* @__PURE__ */ React21.createElement(View_default, _extends({}, rest, {
      "aria-modal": true,
      ref: forwardedRef,
      role: active ? "dialog" : null,
      style
    }), /* @__PURE__ */ React21.createElement(View_default, {
      style: styles11.container
    }, children));
  });
  var styles11 = StyleSheet_default.create({
    modal: {
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    modalTransparent: {
      backgroundColor: "transparent"
    },
    modalOpaque: {
      backgroundColor: "white"
    },
    container: {
      top: 0,
      flex: 1
    }
  });
  var ModalContent_default = ModalContent;

  // node_modules/react-native-web/dist/exports/Modal/ModalFocusTrap.js
  var React22 = __toESM(require_react());
  var FocusBracket = () => {
    return createElement_default("div", {
      role: "none",
      tabIndex: 0,
      style: styles12.focusBracket
    });
  };
  function attemptFocus(element) {
    if (!canUseDom_default) {
      return false;
    }
    try {
      element.focus();
    } catch (e) {
    }
    return document.activeElement === element;
  }
  function focusFirstDescendant(element) {
    for (var i = 0; i < element.childNodes.length; i++) {
      var child = element.childNodes[i];
      if (attemptFocus(child) || focusFirstDescendant(child)) {
        return true;
      }
    }
    return false;
  }
  function focusLastDescendant(element) {
    for (var i = element.childNodes.length - 1; i >= 0; i--) {
      var child = element.childNodes[i];
      if (attemptFocus(child) || focusLastDescendant(child)) {
        return true;
      }
    }
    return false;
  }
  var ModalFocusTrap = (_ref) => {
    var active = _ref.active, children = _ref.children;
    var trapElementRef = React22.useRef();
    var focusRef = React22.useRef({
      trapFocusInProgress: false,
      lastFocusedElement: null
    });
    React22.useEffect(() => {
      if (canUseDom_default) {
        var trapFocus = () => {
          if (trapElementRef.current == null || focusRef.current.trapFocusInProgress || !active) {
            return;
          }
          try {
            focusRef.current.trapFocusInProgress = true;
            if (document.activeElement instanceof Node && !trapElementRef.current.contains(document.activeElement)) {
              var hasFocused = focusFirstDescendant(trapElementRef.current);
              if (focusRef.current.lastFocusedElement === document.activeElement) {
                hasFocused = focusLastDescendant(trapElementRef.current);
              }
              if (!hasFocused && trapElementRef.current != null && document.activeElement) {
                UIManager_default.focus(trapElementRef.current);
              }
            }
          } finally {
            focusRef.current.trapFocusInProgress = false;
          }
          focusRef.current.lastFocusedElement = document.activeElement;
        };
        trapFocus();
        document.addEventListener("focus", trapFocus, true);
        return () => document.removeEventListener("focus", trapFocus, true);
      }
    }, [active]);
    React22.useEffect(function() {
      if (canUseDom_default) {
        var lastFocusedElementOutsideTrap = document.activeElement;
        return function() {
          if (lastFocusedElementOutsideTrap && document.contains(lastFocusedElementOutsideTrap)) {
            UIManager_default.focus(lastFocusedElementOutsideTrap);
          }
        };
      }
    }, []);
    return /* @__PURE__ */ React22.createElement(React22.Fragment, null, /* @__PURE__ */ React22.createElement(FocusBracket, null), /* @__PURE__ */ React22.createElement(View_default, {
      ref: trapElementRef
    }, children), /* @__PURE__ */ React22.createElement(FocusBracket, null));
  };
  var ModalFocusTrap_default = ModalFocusTrap;
  var styles12 = StyleSheet_default.create({
    focusBracket: {
      outlineStyle: "none"
    }
  });

  // node_modules/react-native-web/dist/exports/Modal/index.js
  var _excluded13 = ["animationType", "children", "onDismiss", "onRequestClose", "onShow", "transparent", "visible"];
  var uniqueModalIdentifier = 0;
  var activeModalStack = [];
  var activeModalListeners = {};
  function notifyActiveModalListeners() {
    if (activeModalStack.length === 0) {
      return;
    }
    var activeModalId = activeModalStack[activeModalStack.length - 1];
    activeModalStack.forEach((modalId) => {
      if (modalId in activeModalListeners) {
        activeModalListeners[modalId](modalId === activeModalId);
      }
    });
  }
  function removeActiveModal(modalId) {
    if (modalId in activeModalListeners) {
      activeModalListeners[modalId](false);
      delete activeModalListeners[modalId];
    }
    var index = activeModalStack.indexOf(modalId);
    if (index !== -1) {
      activeModalStack.splice(index, 1);
      notifyActiveModalListeners();
    }
  }
  function addActiveModal(modalId, listener) {
    removeActiveModal(modalId);
    activeModalStack.push(modalId);
    activeModalListeners[modalId] = listener;
    notifyActiveModalListeners();
  }
  var Modal = /* @__PURE__ */ React23.forwardRef((props, forwardedRef) => {
    var animationType = props.animationType, children = props.children, onDismiss = props.onDismiss, onRequestClose = props.onRequestClose, onShow = props.onShow, transparent = props.transparent, _props$visible = props.visible, visible = _props$visible === void 0 ? true : _props$visible, rest = _objectWithoutPropertiesLoose(props, _excluded13);
    var modalId = React23.useMemo(() => uniqueModalIdentifier++, []);
    var _React$useState = React23.useState(false), isActive = _React$useState[0], setIsActive = _React$useState[1];
    var onDismissCallback = React23.useCallback(() => {
      removeActiveModal(modalId);
      if (onDismiss) {
        onDismiss();
      }
    }, [modalId, onDismiss]);
    var onShowCallback = React23.useCallback(() => {
      addActiveModal(modalId, setIsActive);
      if (onShow) {
        onShow();
      }
    }, [modalId, onShow]);
    React23.useEffect(() => {
      return () => removeActiveModal(modalId);
    }, [modalId]);
    return /* @__PURE__ */ React23.createElement(ModalPortal_default, null, /* @__PURE__ */ React23.createElement(ModalAnimation_default, {
      animationType,
      onDismiss: onDismissCallback,
      onShow: onShowCallback,
      visible
    }, /* @__PURE__ */ React23.createElement(ModalFocusTrap_default, {
      active: isActive
    }, /* @__PURE__ */ React23.createElement(ModalContent_default, _extends({}, rest, {
      active: isActive,
      onRequestClose,
      ref: forwardedRef,
      transparent
    }), children))));
  });
  var Modal_default = Modal;

  // node_modules/react-native-web/dist/exports/Pressable/index.js
  var React24 = __toESM(require_react());
  var import_react10 = __toESM(require_react());

  // node_modules/react-native-web/dist/modules/addEventListener/index.js
  var emptyFunction2 = () => {
  };
  function supportsPassiveEvents() {
    var supported = false;
    if (canUseDom_default) {
      try {
        var options = {};
        Object.defineProperty(options, "passive", {
          get() {
            supported = true;
            return false;
          }
        });
        window.addEventListener("test", null, options);
        window.removeEventListener("test", null, options);
      } catch (e) {
      }
    }
    return supported;
  }
  var canUsePassiveEvents = supportsPassiveEvents();
  function getOptions(options) {
    if (options == null) {
      return false;
    }
    return canUsePassiveEvents ? options : Boolean(options.capture);
  }
  function isPropagationStopped() {
    return this.cancelBubble;
  }
  function isDefaultPrevented() {
    return this.defaultPrevented;
  }
  function normalizeEvent(event) {
    event.nativeEvent = event;
    event.persist = emptyFunction2;
    event.isDefaultPrevented = isDefaultPrevented;
    event.isPropagationStopped = isPropagationStopped;
    return event;
  }
  function addEventListener(target, type, listener, options) {
    var opts2 = getOptions(options);
    var compatListener = (e) => listener(normalizeEvent(e));
    target.addEventListener(type, compatListener, opts2);
    return function removeEventListener() {
      if (target != null) {
        target.removeEventListener(type, compatListener, opts2);
      }
    };
  }

  // node_modules/react-native-web/dist/modules/modality/index.js
  var supportsPointerEvent = () => !!(typeof window !== "undefined" && window.PointerEvent != null);
  var activeModality = "keyboard";
  var modality = "keyboard";
  var previousModality;
  var previousActiveModality;
  var isEmulatingMouseEvents2 = false;
  var listeners2 = /* @__PURE__ */ new Set();
  var KEYBOARD = "keyboard";
  var MOUSE = "mouse";
  var TOUCH = "touch";
  var BLUR = "blur";
  var CONTEXTMENU = "contextmenu";
  var FOCUS = "focus";
  var KEYDOWN = "keydown";
  var MOUSEDOWN = "mousedown";
  var MOUSEMOVE = "mousemove";
  var MOUSEUP = "mouseup";
  var POINTERDOWN = "pointerdown";
  var POINTERMOVE = "pointermove";
  var SCROLL2 = "scroll";
  var SELECTIONCHANGE = "selectionchange";
  var TOUCHCANCEL = "touchcancel";
  var TOUCHMOVE = "touchmove";
  var TOUCHSTART = "touchstart";
  var VISIBILITYCHANGE = "visibilitychange";
  var bubbleOptions = {
    passive: true
  };
  var captureOptions = {
    capture: true,
    passive: true
  };
  function restoreModality() {
    if (previousModality != null || previousActiveModality != null) {
      if (previousModality != null) {
        modality = previousModality;
        previousModality = null;
      }
      if (previousActiveModality != null) {
        activeModality = previousActiveModality;
        previousActiveModality = null;
      }
      callListeners();
    }
  }
  function onBlurWindow() {
    previousModality = modality;
    previousActiveModality = activeModality;
    activeModality = KEYBOARD;
    modality = KEYBOARD;
    callListeners();
    isEmulatingMouseEvents2 = false;
  }
  function onFocusWindow() {
    restoreModality();
  }
  function onKeyDown(event) {
    if (event.metaKey || event.altKey || event.ctrlKey) {
      return;
    }
    if (modality !== KEYBOARD) {
      modality = KEYBOARD;
      activeModality = KEYBOARD;
      callListeners();
    }
  }
  function onVisibilityChange() {
    if (document.visibilityState !== "hidden") {
      restoreModality();
    }
  }
  function onPointerish(event) {
    var eventType = event.type;
    if (supportsPointerEvent()) {
      if (eventType === POINTERDOWN) {
        if (activeModality !== event.pointerType) {
          modality = event.pointerType;
          activeModality = event.pointerType;
          callListeners();
        }
        return;
      }
      if (eventType === POINTERMOVE) {
        if (modality !== event.pointerType) {
          modality = event.pointerType;
          callListeners();
        }
        return;
      }
    } else {
      if (!isEmulatingMouseEvents2) {
        if (eventType === MOUSEDOWN) {
          if (activeModality !== MOUSE) {
            modality = MOUSE;
            activeModality = MOUSE;
            callListeners();
          }
        }
        if (eventType === MOUSEMOVE) {
          if (modality !== MOUSE) {
            modality = MOUSE;
            callListeners();
          }
        }
      }
      if (eventType === TOUCHSTART) {
        isEmulatingMouseEvents2 = true;
        if (event.touches && event.touches.length > 1) {
          isEmulatingMouseEvents2 = false;
        }
        if (activeModality !== TOUCH) {
          modality = TOUCH;
          activeModality = TOUCH;
          callListeners();
        }
        return;
      }
      if (eventType === CONTEXTMENU || eventType === MOUSEUP || eventType === SELECTIONCHANGE || eventType === SCROLL2 || eventType === TOUCHCANCEL || eventType === TOUCHMOVE) {
        isEmulatingMouseEvents2 = false;
      }
    }
  }
  if (canUseDom_default) {
    addEventListener(window, BLUR, onBlurWindow, bubbleOptions);
    addEventListener(window, FOCUS, onFocusWindow, bubbleOptions);
    addEventListener(document, KEYDOWN, onKeyDown, captureOptions);
    addEventListener(document, VISIBILITYCHANGE, onVisibilityChange, captureOptions);
    addEventListener(document, POINTERDOWN, onPointerish, captureOptions);
    addEventListener(document, POINTERMOVE, onPointerish, captureOptions);
    addEventListener(document, CONTEXTMENU, onPointerish, captureOptions);
    addEventListener(document, MOUSEDOWN, onPointerish, captureOptions);
    addEventListener(document, MOUSEMOVE, onPointerish, captureOptions);
    addEventListener(document, MOUSEUP, onPointerish, captureOptions);
    addEventListener(document, TOUCHCANCEL, onPointerish, captureOptions);
    addEventListener(document, TOUCHMOVE, onPointerish, captureOptions);
    addEventListener(document, TOUCHSTART, onPointerish, captureOptions);
    addEventListener(document, SELECTIONCHANGE, onPointerish, captureOptions);
    addEventListener(document, SCROLL2, onPointerish, captureOptions);
  }
  function callListeners() {
    var value = {
      activeModality,
      modality
    };
    listeners2.forEach((listener) => {
      listener(value);
    });
  }
  function getModality() {
    return modality;
  }

  // node_modules/react-native-web/dist/modules/useEvent/index.js
  function useEvent(eventType, options) {
    var targetListeners = useStable(() => /* @__PURE__ */ new Map());
    var addListener = useStable(() => {
      return (target, callback) => {
        var removeTargetListener = targetListeners.get(target);
        if (removeTargetListener != null) {
          removeTargetListener();
        }
        if (callback == null) {
          targetListeners.delete(target);
          callback = () => {
          };
        }
        var removeEventListener = addEventListener(target, eventType, callback, options);
        targetListeners.set(target, removeEventListener);
        return removeEventListener;
      };
    });
    useLayoutEffect_default(() => {
      return () => {
        targetListeners.forEach((removeListener) => {
          removeListener();
        });
        targetListeners.clear();
      };
    }, [targetListeners]);
    return addListener;
  }

  // node_modules/react-native-web/dist/modules/useHover/index.js
  var emptyObject10 = {};
  var opts = {
    passive: true
  };
  var lockEventType = "react-gui:hover:lock";
  var unlockEventType = "react-gui:hover:unlock";
  var supportsPointerEvent2 = () => !!(typeof window !== "undefined" && window.PointerEvent != null);
  function dispatchCustomEvent(target, type, payload) {
    var event = document.createEvent("CustomEvent");
    var _ref = payload || emptyObject10, _ref$bubbles = _ref.bubbles, bubbles = _ref$bubbles === void 0 ? true : _ref$bubbles, _ref$cancelable = _ref.cancelable, cancelable = _ref$cancelable === void 0 ? true : _ref$cancelable, detail = _ref.detail;
    event.initCustomEvent(type, bubbles, cancelable, detail);
    target.dispatchEvent(event);
  }
  function getPointerType(event) {
    var pointerType = event.pointerType;
    return pointerType != null ? pointerType : getModality();
  }
  function useHover(targetRef, config) {
    var contain = config.contain, disabled = config.disabled, onHoverStart = config.onHoverStart, onHoverChange = config.onHoverChange, onHoverUpdate = config.onHoverUpdate, onHoverEnd = config.onHoverEnd;
    var canUsePE = supportsPointerEvent2();
    var addMoveListener = useEvent(canUsePE ? "pointermove" : "mousemove", opts);
    var addEnterListener = useEvent(canUsePE ? "pointerenter" : "mouseenter", opts);
    var addLeaveListener = useEvent(canUsePE ? "pointerleave" : "mouseleave", opts);
    var addLockListener = useEvent(lockEventType, opts);
    var addUnlockListener = useEvent(unlockEventType, opts);
    useLayoutEffect_default(() => {
      var target = targetRef.current;
      if (target !== null) {
        var hoverEnd = function hoverEnd2(e) {
          if (onHoverEnd != null) {
            onHoverEnd(e);
          }
          if (onHoverChange != null) {
            onHoverChange(false);
          }
          addMoveListener(target, null);
          addLeaveListener(target, null);
        };
        var leaveListener = function leaveListener2(e) {
          var target2 = targetRef.current;
          if (target2 != null && getPointerType(e) !== "touch") {
            if (contain) {
              dispatchCustomEvent(target2, unlockEventType);
            }
            hoverEnd(e);
          }
        };
        var moveListener = function moveListener2(e) {
          if (getPointerType(e) !== "touch") {
            if (onHoverUpdate != null) {
              if (e.x == null) {
                e.x = e.clientX;
              }
              if (e.y == null) {
                e.y = e.clientY;
              }
              onHoverUpdate(e);
            }
          }
        };
        var hoverStart = function hoverStart2(e) {
          if (onHoverStart != null) {
            onHoverStart(e);
          }
          if (onHoverChange != null) {
            onHoverChange(true);
          }
          if (onHoverUpdate != null) {
            addMoveListener(target, !disabled ? moveListener : null);
          }
          addLeaveListener(target, !disabled ? leaveListener : null);
        };
        var enterListener = function enterListener2(e) {
          var target2 = targetRef.current;
          if (target2 != null && getPointerType(e) !== "touch") {
            if (contain) {
              dispatchCustomEvent(target2, lockEventType);
            }
            hoverStart(e);
            var lockListener = function lockListener2(lockEvent) {
              if (lockEvent.target !== target2) {
                hoverEnd(e);
              }
            };
            var unlockListener = function unlockListener2(lockEvent) {
              if (lockEvent.target !== target2) {
                hoverStart(e);
              }
            };
            addLockListener(target2, !disabled ? lockListener : null);
            addUnlockListener(target2, !disabled ? unlockListener : null);
          }
        };
        addEnterListener(target, !disabled ? enterListener : null);
      }
    }, [addEnterListener, addMoveListener, addLeaveListener, addLockListener, addUnlockListener, contain, disabled, onHoverStart, onHoverChange, onHoverUpdate, onHoverEnd, targetRef]);
  }

  // node_modules/react-native-web/dist/exports/Pressable/index.js
  var _excluded14 = ["children", "delayLongPress", "delayPressIn", "delayPressOut", "disabled", "onBlur", "onContextMenu", "onFocus", "onHoverIn", "onHoverOut", "onKeyDown", "onLongPress", "onPress", "onPressMove", "onPressIn", "onPressOut", "style", "tabIndex", "testOnly_hovered", "testOnly_pressed"];
  function Pressable(props, forwardedRef) {
    var children = props.children, delayLongPress = props.delayLongPress, delayPressIn = props.delayPressIn, delayPressOut = props.delayPressOut, disabled = props.disabled, onBlur = props.onBlur, onContextMenu = props.onContextMenu, onFocus = props.onFocus, onHoverIn = props.onHoverIn, onHoverOut = props.onHoverOut, onKeyDown2 = props.onKeyDown, onLongPress = props.onLongPress, onPress = props.onPress, onPressMove = props.onPressMove, onPressIn = props.onPressIn, onPressOut = props.onPressOut, style = props.style, tabIndex = props.tabIndex, testOnly_hovered = props.testOnly_hovered, testOnly_pressed = props.testOnly_pressed, rest = _objectWithoutPropertiesLoose(props, _excluded14);
    var _useForceableState = useForceableState(testOnly_hovered === true), hovered = _useForceableState[0], setHovered = _useForceableState[1];
    var _useForceableState2 = useForceableState(false), focused = _useForceableState2[0], setFocused = _useForceableState2[1];
    var _useForceableState3 = useForceableState(testOnly_pressed === true), pressed = _useForceableState3[0], setPressed = _useForceableState3[1];
    var hostRef = (0, import_react10.useRef)(null);
    var setRef = useMergeRefs(forwardedRef, hostRef);
    var pressConfig = (0, import_react10.useMemo)(() => ({
      delayLongPress,
      delayPressStart: delayPressIn,
      delayPressEnd: delayPressOut,
      disabled,
      onLongPress,
      onPress,
      onPressChange: setPressed,
      onPressStart: onPressIn,
      onPressMove,
      onPressEnd: onPressOut
    }), [delayLongPress, delayPressIn, delayPressOut, disabled, onLongPress, onPress, onPressIn, onPressMove, onPressOut, setPressed]);
    var pressEventHandlers = usePressEvents(hostRef, pressConfig);
    var onContextMenuPress = pressEventHandlers.onContextMenu, onKeyDownPress = pressEventHandlers.onKeyDown;
    useHover(hostRef, {
      contain: true,
      disabled,
      onHoverChange: setHovered,
      onHoverStart: onHoverIn,
      onHoverEnd: onHoverOut
    });
    var interactionState = {
      hovered,
      focused,
      pressed
    };
    var blurHandler = React24.useCallback((e) => {
      if (e.nativeEvent.target === hostRef.current) {
        setFocused(false);
        if (onBlur != null) {
          onBlur(e);
        }
      }
    }, [hostRef, setFocused, onBlur]);
    var focusHandler = React24.useCallback((e) => {
      if (e.nativeEvent.target === hostRef.current) {
        setFocused(true);
        if (onFocus != null) {
          onFocus(e);
        }
      }
    }, [hostRef, setFocused, onFocus]);
    var contextMenuHandler = React24.useCallback((e) => {
      if (onContextMenuPress != null) {
        onContextMenuPress(e);
      }
      if (onContextMenu != null) {
        onContextMenu(e);
      }
    }, [onContextMenu, onContextMenuPress]);
    var keyDownHandler = React24.useCallback((e) => {
      if (onKeyDownPress != null) {
        onKeyDownPress(e);
      }
      if (onKeyDown2 != null) {
        onKeyDown2(e);
      }
    }, [onKeyDown2, onKeyDownPress]);
    var _tabIndex;
    if (tabIndex !== void 0) {
      _tabIndex = tabIndex;
    } else {
      _tabIndex = disabled ? -1 : 0;
    }
    return /* @__PURE__ */ React24.createElement(View_default, _extends({}, rest, pressEventHandlers, {
      "aria-disabled": disabled,
      onBlur: blurHandler,
      onContextMenu: contextMenuHandler,
      onFocus: focusHandler,
      onKeyDown: keyDownHandler,
      ref: setRef,
      style: [disabled ? styles13.disabled : styles13.active, typeof style === "function" ? style(interactionState) : style],
      tabIndex: _tabIndex
    }), typeof children === "function" ? children(interactionState) : children);
  }
  function useForceableState(forced) {
    var _useState = (0, import_react10.useState)(false), bool = _useState[0], setBool = _useState[1];
    return [bool || forced, setBool];
  }
  var styles13 = StyleSheet_default.create({
    active: {
      cursor: "pointer",
      touchAction: "manipulation"
    },
    disabled: {
      pointerEvents: "box-none"
    }
  });
  var MemoedPressable = /* @__PURE__ */ (0, import_react10.memo)(/* @__PURE__ */ (0, import_react10.forwardRef)(Pressable));
  MemoedPressable.displayName = "Pressable";
  var Pressable_default = MemoedPressable;

  // components/aitour/InspectionNotesDialog.tsx
  var import_react11 = __toESM(require_react());

  // ../test_reports/artifacts_iter49/notes-dialog-safe-area-fixture.ts
  function useSafeAreaInsets() {
    return { top: 20, bottom: 34, left: 0, right: 0 };
  }

  // ../test_reports/artifacts_iter49/notes-dialog-api-fixture.ts
  async function fetchCustomerInspectionNotes() {
    const w2 = window;
    if (w2.notesTestMode === "error") throw new Error("Errore simulato solo nel test");
    const rows = Array.from({ length: 55 }, (_, i) => ({
      id: `isolated-${i}`,
      date: "2026-09-24T10:00:00.000Z",
      photoCount: i % 2,
      notes: `Nota di prova ${i + 1}. Testo sufficientemente lungo per verificare lo scorrimento sullo schermo del telefono.`
    }));
    if (w2.notesTestMode === "pending") return new Promise((resolve) => {
      w2.releaseTestNotes = () => resolve(rows);
    });
    return rows;
  }

  // node_modules/merge-options/index.mjs
  var import_index = __toESM(require_merge_options(), 1);
  var merge_options_default = import_index.default;

  // node_modules/@react-native-async-storage/async-storage/lib/module/AsyncStorage.js
  var merge = merge_options_default.bind({
    concatArrays: true,
    ignoreUndefined: true
  });

  // lib/theme.ts
  var THEME_MODE_KEY = "@voom_theme_mode";
  var COLORS_LIGHT = {
    // Brand — Viola AI Tour
    primary: "#7C3AED",
    primaryDark: "#5B21B6",
    primaryLight: "#8B5CF6",
    primarySoft: "#F5F3FF",
    // Semantic
    success: "#10B981",
    successSoft: "#D1FAE5",
    warning: "#F59E0B",
    warningSoft: "#FEF3C7",
    danger: "#DC2626",
    dangerSoft: "#FEE2E2",
    info: "#0EA5E9",
    infoSoft: "#E0F2FE",
    // Accents
    purple: "#8B5CF6",
    purpleSoft: "#F3E8FF",
    pink: "#EC4899",
    pinkSoft: "#FCE7F3",
    teal: "#14B8A6",
    tealSoft: "#CCFBF1",
    amber: "#F59E0B",
    orange: "#F97316",
    orangeSoft: "#FFF7ED",
    // Neutrals
    white: "#FFFFFF",
    black: "#000000",
    bg: "#F3F4F6",
    bgAlt: "#F9FAFB",
    surface: "#FFFFFF",
    border: "#E5E7EB",
    borderLight: "#F3F4F6",
    text: "#1F2937",
    textSecondary: "#4B5563",
    textMuted: "#6B7280",
    textLight: "#9CA3AF",
    textPlaceholder: "#D1D5DB"
  };
  var COLORS_DARK = {
    primary: "#8B5CF6",
    primaryDark: "#7C3AED",
    primaryLight: "#A78BFA",
    primarySoft: "#2A2044",
    success: "#34D399",
    successSoft: "#0E3A2C",
    warning: "#FBBF24",
    warningSoft: "#3D2E0A",
    danger: "#F87171",
    dangerSoft: "#431418",
    info: "#38BDF8",
    infoSoft: "#0B2C3D",
    purple: "#A78BFA",
    purpleSoft: "#2A2044",
    pink: "#F472B6",
    pinkSoft: "#3D1230",
    teal: "#2DD4BF",
    tealSoft: "#0B322E",
    amber: "#FBBF24",
    orange: "#FB923C",
    orangeSoft: "#3A2410",
    white: "#FFFFFF",
    black: "#000000",
    bg: "#0B0714",
    bgAlt: "#110C1D",
    surface: "#171221",
    border: "#2A2440",
    borderLight: "#231C36",
    text: "#F5F3F9",
    textSecondary: "#D6D1E0",
    textMuted: "#A29BB3",
    textLight: "#7A7390",
    textPlaceholder: "#554E6B"
  };
  var COLORS = { ...COLORS_DARK };
  var DS_LIGHT = {
    // Brand
    brand: "#7C3AED",
    brandDark: "#5B21B6",
    brandSoft: "#EDE9FE",
    brandTint: "#F5F3FF",
    // Accento arancio (dal poster AI Tour)
    accent: "#F97316",
    accentSoft: "#FFF7ED",
    // Teal live
    live: "#0D9488",
    liveSoft: "#CCFBF1",
    // Superfici (scala iOS)
    surface: "#FFFFFF",
    surface2: "#F2F2F7",
    surface3: "#E5E5EA",
    // Testo
    ink: "#1C1C1E",
    ink2: "#3A3A3C",
    inkMuted: "#8E8E93",
    // Bordi
    border: "#E5E5EA",
    borderStrong: "#D1D1D6",
    // Semantici (alto contrasto per esterni)
    success: "#166534",
    warning: "#B45309",
    error: "#991B1B"
  };
  var DS_DARK = {
    brand: "#8B5CF6",
    brandDark: "#A78BFA",
    brandSoft: "#2A2044",
    brandTint: "#1D1630",
    accent: "#FB923C",
    accentSoft: "#3A2410",
    live: "#2DD4BF",
    liveSoft: "#0B322E",
    surface: "#171221",
    surface2: "#0B0714",
    surface3: "#241D33",
    ink: "#F5F3F9",
    ink2: "#D6D1E0",
    inkMuted: "#938DA3",
    border: "#2A2440",
    borderStrong: "#3A3153",
    success: "#34D399",
    warning: "#FBBF24",
    error: "#F87171"
  };
  var DS = { ...DS_DARK };
  var currentThemeMode = "dark";
  function applyThemeMode(mode) {
    currentThemeMode = mode;
    Object.assign(DS, mode === "dark" ? DS_DARK : DS_LIGHT);
    Object.assign(COLORS, mode === "dark" ? COLORS_DARK : COLORS_LIGHT);
    try {
      const doc = globalThis.document;
      if (doc?.documentElement) doc.documentElement.style.backgroundColor = COLORS.bg;
      if (doc?.body) doc.body.style.backgroundColor = COLORS.bg;
    } catch {
    }
  }
  try {
    const ls = globalThis.localStorage;
    if (ls) applyThemeMode(ls.getItem(THEME_MODE_KEY) === "light" ? "light" : "dark");
  } catch {
  }
  var JAKARTA = {
    regular: "Jakarta_400",
    medium: "Jakarta_500",
    semibold: "Jakarta_600",
    bold: "Jakarta_700"
  };

  // components/HistoryFeedback.tsx
  var import_jsx_runtime = __toESM(require_jsx_runtime());
  function ReadErrorNotice({ id, message, onRetry, busy = false }) {
    if (!message) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(View_default, { testID: `${id}-error`, style: styles14.errorBox, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Text_default, { testID: `${id}-error-message`, accessibilityRole: "alert", style: styles14.errorText, children: message }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchableOpacity_default, { testID: `${id}-retry`, accessibilityRole: "button", disabled: busy, onPress: onRetry, style: styles14.button, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Text_default, { testID: `${id}-retry-label`, style: styles14.buttonText, children: "Riprova" }) })
    ] });
  }
  var styles14 = StyleSheet_default.create({
    errorBox: { padding: 14, marginHorizontal: 16, marginVertical: 8, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 12, backgroundColor: COLORS.surface },
    errorText: { color: COLORS.danger, fontSize: 14, lineHeight: 20 },
    button: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
    buttonText: { color: COLORS.primary, fontSize: 14, fontWeight: "600" },
    footer: { alignItems: "center", paddingVertical: 16, gap: 8 },
    caption: { color: COLORS.textMuted, fontSize: 12 }
  });

  // components/aitour/InspectionNotesDialog.tsx
  var import_jsx_runtime2 = __toESM(require_jsx_runtime());
  function InspectionNotesDialog({ agentId, customerId, name, onClose }) {
    const insets = useSafeAreaInsets();
    const [items, setItems] = (0, import_react11.useState)([]);
    const [loading, setLoading] = (0, import_react11.useState)(true);
    const [error, setError] = (0, import_react11.useState)("");
    const sequence = (0, import_react11.useRef)(0);
    const load = (0, import_react11.useCallback)(async () => {
      const request = ++sequence.current;
      setLoading(true);
      setError("");
      try {
        const rows = await fetchCustomerInspectionNotes(customerId, agentId);
        if (request === sequence.current) setItems(rows);
      } catch {
        if (request === sequence.current) setError("Impossibile caricare le note. Controlla la connessione e riprova.");
      } finally {
        if (request === sequence.current) setLoading(false);
      }
    }, [agentId, customerId]);
    (0, import_react11.useEffect)(() => {
      void load();
      return () => {
        sequence.current += 1;
      };
    }, [load]);
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Modal_default, { visible: true, transparent: true, animationType: "fade", onRequestClose: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(View_default, { style: [styles15.backdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }], children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(View_default, { testID: "aitour-inspection-notes-dialog", style: styles15.dialog, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Text_default, { testID: "aitour-inspection-notes-title", style: styles15.title, children: "Note da Ispezioni" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Text_default, { testID: "aitour-inspection-notes-customer", style: styles15.customer, numberOfLines: 2, children: name }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ReadErrorNotice, { id: "aitour-inspection-notes", message: error, onRetry: load, busy: loading }),
      loading ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ActivityIndicator_default, { testID: "aitour-inspection-notes-loading", style: styles15.loading, color: DS.brand }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        FlatList_default2,
        {
          testID: "aitour-inspection-notes-scroll",
          style: styles15.list,
          data: items,
          keyExtractor: (item) => item.id,
          ListHeaderComponent: !error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Text_default, { testID: "aitour-inspection-notes-count", style: styles15.caption, children: [
            items.length,
            " note \xB7 dalla pi\xF9 recente"
          ] }) : null,
          ListEmptyComponent: !error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Text_default, { testID: "aitour-inspection-notes-empty", style: styles15.empty, children: "Nessuna nota registrata nelle ispezioni precedenti di questo cliente." }) : null,
          renderItem: ({ item }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(View_default, { testID: `aitour-inspection-note-${item.id}`, style: styles15.note, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Text_default, { testID: `aitour-inspection-note-${item.id}-date`, style: styles15.date, children: new Date(item.date).toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Text_default, { testID: `aitour-inspection-note-${item.id}-text`, style: styles15.text, children: item.notes }),
            item.photoCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Text_default, { testID: `aitour-inspection-note-${item.id}-photos`, style: styles15.caption, children: [
              item.photoCount,
              " foto"
            ] })
          ] })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TouchableOpacity_default, { testID: "aitour-inspection-notes-close", accessibilityRole: "button", style: styles15.close, onPress: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Text_default, { style: styles15.closeText, children: "Chiudi" }) })
    ] }) }) });
  }
  var styles15 = StyleSheet_default.create({
    backdrop: { flex: 1, backgroundColor: "#00000099", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
    dialog: { width: "100%", maxWidth: 440, maxHeight: "90%", backgroundColor: DS.surface, borderRadius: 20, padding: 20 },
    title: { color: DS.ink, fontSize: 20, fontFamily: JAKARTA.bold },
    customer: { color: DS.ink2, fontSize: 14, marginTop: 8, marginBottom: 12 },
    list: { flexGrow: 0, flexShrink: 1 },
    loading: { paddingVertical: 30 },
    note: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: DS.border, gap: 6 },
    date: { color: DS.brand, fontSize: 12, fontFamily: JAKARTA.semibold },
    text: { color: DS.ink, fontSize: 15, lineHeight: 22 },
    caption: { color: DS.inkMuted, fontSize: 12 },
    empty: { color: DS.inkMuted, fontSize: 14, lineHeight: 21, paddingVertical: 18 },
    close: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 12 },
    closeText: { color: DS.brand, fontFamily: JAKARTA.semibold, fontSize: 15 }
  });

  // ../test_reports/artifacts_iter49/notes-dialog-harness.tsx
  var import_jsx_runtime3 = __toESM(require_jsx_runtime());
  function Harness() {
    const [visible, setVisible] = (0, import_react12.useState)(false);
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(View_default, { style: { padding: 24 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Pressable_default, { testID: "notes-test-open", onPress: () => setVisible(true), style: { minHeight: 44 }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Text_default, { children: "Apri note di prova" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Text_default, { testID: "notes-test-state", children: visible ? "aperto" : "chiuso" }),
      visible && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(InspectionNotesDialog, { agentId: "isolated-agent", customerId: "isolated-customer", name: "Cliente di prova isolata", onClose: () => setVisible(false) })
    ] });
  }
  (0, import_client.createRoot)(document.getElementById("root")).render(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Harness, {}));
})();
/*! Bundled license information:

react/cjs/react.production.js:
  (**
   * @license React
   * react.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

scheduler/cjs/scheduler.production.js:
  (**
   * @license React
   * scheduler.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-dom/cjs/react-dom.production.js:
  (**
   * @license React
   * react-dom.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-dom/cjs/react-dom-client.production.js:
  (**
   * @license React
   * react-dom-client.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react-jsx-runtime.production.js:
  (**
   * @license React
   * react-jsx-runtime.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
