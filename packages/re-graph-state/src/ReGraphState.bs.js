'use strict';

var GraphState = require("graph-state");
var ReactGraphState = require("react-graph-state");

var GraphDomain = {};

var node = GraphState.createGraphNode({
      get: (function (param) {
          return 0;
        }),
      key: undefined
    });

ReactGraphState.useGraphNodeHydrate(node, 1);

exports.GraphDomain = GraphDomain;
exports.node = node;
/* node Not a pure module */
