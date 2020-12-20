# bs-graph-state

> Rescript bindings for `graph-state`

[![NPM](https://img.shields.io/npm/v/bs-graph-state.svg)](https://www.npmjs.com/package/bs-graph-state) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
yarn add bs-graph-state
```

## Usage

```reasonml
open BsGraphState;

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
```

## Features

### 🚧 UNDER CONSTRUCTION 🚧

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
