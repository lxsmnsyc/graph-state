open BsGraphState;
open React;

module GraphDomain = {
  [@bs.obj]
  external makeProps: (~children: element, ~key: 'key=?, unit) => {. "children": element};
  [@bs.module "react-graph-state"]
  external make: component({. "children": element}) = "GraphDomain";
};

[@bs.module "react-graph-state"]
external useGraphNodeValue: GraphState.Node.Instance.t('s, 'a) => 's = "useGraphNodeValue";

[@bs.module "react-graph-state"]
external useGraphNodeDispatch: GraphState.Node.Instance.t('s, 'a) => 'a => unit = "useGraphNodeDispatch";

[@bs.module "react-graph-state"]
external useGraphNodeReset: GraphState.Node.Instance.t('s, 'a) => unit => unit = "useGraphNodeReset";

[@bs.module "react-graph-state"]
external useGraphNodeSnapshot: GraphState.Node.Instance.t('s, 'a) => ('s => unit) => unit = "useGraphNodeSnapshot";

[@bs.module "react-graph-state"]
external useGraphNodeState: GraphState.Node.Instance.t('s, 'a) => ('s, 'a => unit, unit => unit) = "useGraphNodeState";

[@bs.module "react-graph-state"]
external useGraphNodeMutate: GraphState.Node.Instance.t('s, 'a) => 's => unit = "useGraphNodeMutate";

[@bs.module "react-graph-state"]
external useGraphNodeHydrate: GraphState.Node.Instance.t('s, 'a) => 's => unit = "useGraphNodeHydrate";
