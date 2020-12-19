

module Memory = {
  module Batcher = {
    type t = (unit => unit) => unit;
  }
  module Nodes = {
    type t;
  };
  type t = {
    nodes: Nodes.t,
    batcher: Batcher.t,
  };

  [@bs.module "graph-state"]
  external make: option(Batcher.t) => t = "createGraphDomainMemory";

  [@bs.module "graph-state"]
  external destroy: t => unit = "destroyGraphDomainMemory";
};

module Node = {
  module Instance = {
    type t('state, 'action) = {
      key: string,
    };
  };
  
  module Options = {
    module Subscription = {
      type t = unit => option(unit => unit);
    };
    module Get = {
      module Context = {
        type t('state, 'action) = {
          get: 's 'a . Instance.t('state, 'action) => 's,
          set: 's 'a . Instance.t('state, 'action) => 'a => unit,
          mutate: 's 'a . Instance.t('state, 'action) => 's => unit,
          reset: 's 'a . Instance.t('state, 'action) => unit,
          setSelf: 'action => unit,
          mutateSelf: 'state => unit,
          subscription: Subscription.t => unit,
        };
      };

      type t('state, 'action) = Context.t('state, 'action) => 'state;
    };
    module Set = {
      module Context = {
        type t('state, 'action) = {
          get: 's 'a . Instance.t('state, 'action) => 's,
          set: 's 'a . Instance.t('state, 'action) => 'a => unit,
          mutate: 's 'a . Instance.t('state, 'action) => 's => unit,
          reset: 's 'a . Instance.t('state, 'action) => unit,
          setSelf: 'action => unit,
          mutateSelf: 'state => unit,
        };
      };

      type t('state, 'action) = Context.t('state, 'action) => 'state;
    };

    type t('state, 'action) = {
      get: Get.t('state, 'action),
      set: Set.t('state, 'action),
      key: option(string),
    };

    module Basic = {
      type t('state) = {
        get: Get.t('state, 'state => 'state),
        key: option(string),
      };
    };
  };

  [@bs.module "graph-state"]
  external make: Options.t('state, 'action) => Instance.t('state, 'action) = "createGraphNode";

  [@bs.module "graph-state"]
  external makeBasic: Options.Basic.t('state) => Instance.t('state, 'state => 'state) = "createGraphNode";

  [@bs.module "graph-state"]
  external runDispatch: Memory.t => Instance.t('state, 'action) => 'action => unit = "runGraphNodeDispatch";

  [@bs.module "graph-state"]
  external runCompute: Memory.t => Instance.t('state, 'action) => unit = "runGraphNodeCompute";

  [@bs.module "graph-state"]
  external runUpdate: Memory.t => Instance.t('state, 'action) => bool => unit = "runGraphNodeUpdate";

  [@bs.module "graph-state"]
  external setState: Memory.t => Instance.t('state, 'action) => 'state => bool => unit = "setGraphNodeState";

  [@bs.module "graph-state"]
  external getState: Memory.t => Instance.t('state, 'action) => 'state = "getGraphNodeState";

  [@bs.module "graph-state"]
  external subscribe: Memory.t => Instance.t('state, 'action) => ('state => unit) => (unit => unit) = "subscribeGraphNode";

  [@bs.module "graph-state"]
  external getVersion: Memory.t => Instance.t('state, 'action) => int = "getGraphNodeVersion";

  [@bs.module "graph-state"]
  external hasGraphNode: Memory.t => Instance.t('state, 'action) => bool = "hasGraphNode";

  [@bs.module "graph-state"]
  external hasGraphNodeState: Memory.t => Instance.t('state, 'action) => bool = "hasGraphNodeState";
};

module Factory = {
  module Options = {
    type t('args, 'state, 'action) = {
      get: 'args => Node.Options.Get.t('state, 'action),
      set: 'args => Node.Options.Set.t('state, 'action),
      key: option('args => string),
      baseKey: option(string),
    };

    module Basic = {
      type t('args, 'state) = {
        get: 'args => Node.Options.Get.t('state, 'state => 'state),
        key: option(string),
      };
    };
  };

  [@bs.module "graph-state"]
  external make: Options.t('args, 'state, 'action) => 'args => Node.Instance.t('state, 'action) = "createGraphNodeFactory";

  [@bs.module "graph-state"]
  external makeBasic: Options.Basic.t('args, 'state) => 'args => Node.Instance.t('state, 'state => 'state) = "createGraphNodeFactory";
};
