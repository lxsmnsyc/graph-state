import { GraphNodeDraftState, GraphNode, GraphDomainInterface } from 'graph-state';
import { ExternalSubject } from 'react-external-subject';

export type GraphNodeGetSubject =
  <S, A = GraphNodeDraftState<S>>(node: GraphNode<S, A>) => ExternalSubject<S>;

export interface GraphCoreInterface extends GraphDomainInterface {
  getSubject: GraphNodeGetSubject;
}
