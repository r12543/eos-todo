import React from "react";
import ReactDOM from "react-dom";
import EOS from "eosjs";
import update from "react-addons-update";

import { isEqual } from "lodash";

const EOS_CONFIG = {
  contractName: "inno", // Contract name
  contractSender: "inno", // User executing the contract (should be paired with private key)
  network: {
    protocol: "http",
    blockchain: "eos",
    host: "0.0.0.0",
    port: 7777,
    chainId: "cf057bbfb72640471fd910bcb67639c22df9f92470936cddc1ade0e2f2e7dc4f"
  },
  eosOptions: {}
};

function isObjPresentInArray(obj, array) {
  for (let item of array) {
    if (isEqual(obj, item)) return true;
  }
  return false;
}

class TodoForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = { descripion: "" };
  }

  updateInput(e) {
    this.setState({ description: e.target.value });
  }

  saveTodo(e) {
    e.preventDefault();
    this.props.onSubmit(this.state.description);
    this.setState({ description: "" });
  }

  render() {
    return (
      <form onSubmit={this.saveTodo.bind(this)}>
        <input
          type="text"
          value={this.state.description}
          placeholder="Add a new TODO"
          onChange={this.updateInput.bind(this)}
        />
        <button type="submit">Save</button>
      </form>
    );
  }
}

class TodoList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      todos: []
    };
    document.addEventListener(`scatterLoaded`, this.onScatterLoad);
  }

  onScatterLoad = () => {
    const scatter = window.scatter;
    window.scatter = null;
    this.eosClient = scatter.eos(
      EOS_CONFIG.network,
      EOS,
      EOS_CONFIG.eosOptions,
      EOS_CONFIG.network.protocol
    );
    this.setNewPermissions(EOS_CONFIG.contractSender);

    this.loadTodos();
  };

  setNewPermissions = accountName => {
    this.eosClient
      .getAccount(accountName)
      .then(account => {
        let newPerms = this.updatePermissions(
          JSON.parse(JSON.stringify(account.permissions))
        );
        this.eosClient.transaction(tr => {
          for (const perm of newPerms) {
            if (perm.perm_name === "active") {
              tr.updateauth({
                account: accountName,
                permission: perm.perm_name,
                parent: perm.parent,
                auth: perm.required_auth
              });
            }
          }
        });
      })
      .catch(e => {
        console.log(e);
      });
  };

  updatePermissions(permissions) {
    for (let perm of permissions) {
      if (perm.perm_name === "active") {
        let newPerm = {
          permission: {
            actor: EOS_CONFIG.contractSender,
            permission: "eosio.code"
          },
          weight: 1
        };
        if (!isObjPresentInArray(newPerm, perm.required_auth.accounts))
          perm.required_auth.accounts.push(newPerm);
      }
    }
    return permissions;
  }

  loadTodos() {
    this.eosClient
      .getTableRows({
        code: EOS_CONFIG.contractName,
        scope: EOS_CONFIG.contractName,
        table: "todos",
        json: true
      })
      .then(data => {
        this.setState({ todos: data.rows });
      })
      .catch(e => {
        console.error(e);
      });
  }

  addNewTodo(description) {
    this.setState({ loading: true });

    const newTodos = update(this.state.todos, {
      $push: [
        {
          id: this.state.todos.length + 1,
          description: description,
          completed: false
        }
      ]
    });

    this.setState({ todos: newTodos });

    this.eosClient.contract(EOS_CONFIG.contractName).then(contract => {
      contract
        .create(
          EOS_CONFIG.contractSender,
          this.state.todos.length + 1,
          description,
          {
            authorization: [EOS_CONFIG.contractSender]
          }
        )
        .then(res => {
          this.setState({ loading: false });
        })
        .catch(err => {
          this.setState({ loading: false });
          console.log(err);
        });
    });
  }

  completeTodo(id, e) {
    e.preventDefault();
    this.setState({ loading: true });

    var todoIndex = this.state.todos.findIndex(todo => {
      return todo.id == id;
    });

    this.setState({
      todos: update(this.state.todos, {
        [todoIndex]: { $merge: { completed: true } }
      })
    });

    this.eosClient.contract(EOS_CONFIG.contractName).then(contract => {
      contract
        .complete(EOS_CONFIG.contractSender, this.state.todos.length + 1, {
          authorization: [EOS_CONFIG.contractSender]
        })
        .then(res => {
          this.setState({ loading: false });
        })
        .catch(err => {
          this.setState({ loading: false });
          console.log(err);
        });
    });
  }

  removeTodo(id, e) {
    e.preventDefault();
    this.setState({ loading: true });

    var todoIndex = this.state.todos.findIndex(todo => {
      return todo.id == id;
    });
    this.setState({ todos: this.state.todos.filter(todo => todo.id != id) });

    this.eosClient.contract(EOS_CONFIG.contractName).then(contract => {
      contract
        .destroy(EOS_CONFIG.contractSender, this.state.todos.length + 1, {
          authorization: [EOS_CONFIG.contractSender]
        })
        .then(res => {
          this.setState({ loading: false });
        })
        .catch(err => {
          this.setState({ loading: false });
          console.log(err);
        });
    });
  }

  renderTodoItem(todo) {
    return (
      <li key={todo.id}>
        {todo.completed ? (
          <span>[x] </span>
        ) : (
          <input
            type="checkbox"
            onClick={this.completeTodo.bind(this, todo.id)}
            checked={false}
          />
        )}
        {todo.description}{" "}
        {todo.completed ? (
          <a href="#" onClick={this.removeTodo.bind(this, todo.id)}>
            (remove)
          </a>
        ) : (
          ""
        )}
      </li>
    );
  }

  render() {
    return (
      <div>
        <h3>
          My TODOs: {this.state.loading ? <small>(saving...)</small> : ""}
        </h3>
        {this.state.todos.map(this.renderTodoItem.bind(this))}
        <br />
        <TodoForm onSubmit={this.addNewTodo.bind(this)} />
      </div>
    );
  }
}

ReactDOM.render(<TodoList />, document.getElementById("app"));

module.hot.accept();
