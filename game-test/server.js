const http = require("http");
const express = require("express");
const colyseus = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { Schema, MapSchema, type } = require("@colyseus/schema");

class Player extends Schema {
  constructor() {
    super();
    this.choice = "";
  }
}
type("string")(Player.prototype, "choice");

class State extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.result = "";
  }
}
type({ map: Player })(State.prototype, "players");
type("string")(State.prototype, "result");

class RpsRoom extends colyseus.Room {
  onCreate() {
    this.maxClients = 2;
    this.setState(new State());

    this.onMessage("pick", (client, choice) => {
      this.state.players.get(client.sessionId).choice = choice;

      const players = Array.from(this.state.players.values());
      if (players.length === 2 && players.every((player) => player.choice)) {
        this.finishRound();
      }
    });

    this.onMessage("reset", () => {
      for (const player of this.state.players.values()) {
        player.choice = "";
      }
      this.state.result = "";
    });
  }

  onJoin(client) {
    this.state.players.set(client.sessionId, new Player());
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    this.state.result = "";
  }

  finishRound() {
    const [aKey, bKey] = Array.from(this.state.players.keys());
    const a = this.state.players.get(aKey);
    const b = this.state.players.get(bKey);
    const wins = {
      rock: "scissors",
      paper: "rock",
      scissors: "paper",
    };

    if (a.choice === b.choice) {
      this.state.result = "tie";
    } else if (wins[a.choice] === b.choice) {
      this.state.result = aKey;
    } else {
      this.state.result = bKey;
    }
  }
}

const app = express();
const server = http.createServer(app);
const gameServer = new colyseus.Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define("rps", RpsRoom);
app.use(express.static("public"));

gameServer.listen(3000);
server.on("listening", () => {
  console.log("open http://localhost:3000");
});
