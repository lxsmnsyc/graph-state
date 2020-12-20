# re-graph-state

> ReasonReact bindings for `re-graph-state`

[![NPM](https://img.shields.io/npm/v/re-graph-state.svg)](https://www.npmjs.com/package/re-graph-state) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
yarn add bs-graph-state re-graph-state
```

## Usage

```reasonml
open BsGraphState;
open ReGraphState;

let greetingNode = GraphState.Node.makeBasic({
  get: _ => "Hello",
  key: None,
});
let personNode = GraphState.Node.makeBasic({
  get: _ => "John Doe",
  key: None,
});
let messageNode = GraphState.Node.makeBasic({
  get: ({ get }) => get(greetingNode) ++ ", " ++ get(personNode),
  key: None,
});

module Message = {
  [@react.component]
  let make = () => {
    let state = useGraphNodeValue(messageNode);

    <h1>state->React.string</h1>;
  };
};
```

## Features

### 🚧 UNDER CONSTRUCTION 🚧

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
