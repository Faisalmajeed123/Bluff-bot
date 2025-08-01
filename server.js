import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import * as serverfn from "./src/helpers/ServerFunctions.js";
import * as Deck from "./src/helpers/deck.js";
import { v4 as uuidv4 } from "uuid";
import { BotPlayer } from "./src/bot/bot.js";

// TODO: Add bot object and player object separate, by pushing different values in clients
// refer to this chat (https://chatgpt.com/c/6863dc29-277c-800a-b5d4-7a42eef03b16)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const router = express.Router();
const CardDeck = new Deck.Deck();
const rooms = {};
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "src", "views"));

app.use(express.static(path.join(__dirname)));
app.use("/js", express.static(path.join(__dirname, "src", "js", "scripts")));

app.use(express.static("public"));
app.use(express.static(__dirname));
app.use("/js", express.static(path.join(__dirname, "src", "js")));

// Views config
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "src", "views"));

app.get("/", (req, res) => {
  res.render("game");
});
let rcount;
const roomCapacity = 4; //set roomcapacity
const roomCounts = {};

io.on("connection", (socket) => {
  console.log("New connection established. User connected with ID:", socket.id);
  // Find or create a room with available capacity
  let roomId;
  let lastPlayedCardCount = 0;
  for (const [room, count] of Object.entries(roomCounts)) {
    if (count < roomCapacity) {
      roomId = room;
      break;
    }
  }
  // If no room has available capacity, create a new room

  if (!roomId) {
    roomId = uuidv4();
    CardDeck.shuffle();
    roomCounts[roomId] = 0;
    rooms[roomId] = {
      clients: [],
      CardStack: [],
      SuitStack: [],
      passedPlayers: [],
      playerGoingToWin: -1,
      wonUsers: [],
      lastPlayedCardCount: undefined,
      currentTurnIndex: 0,
      playinguserfail: false,
      newGame: true,
      bluff_text: undefined,
      raiseActionDone: false,
      cardset: CardDeck.cards,
      playerCards: {},
      gameState: {
        currentPlayerId: "",
        players: [],
        lastAction: {
          type: "",
          playerId: "",
          bluffText: "",
          wasSuccessful: null,
        },
        discardPile: [],
        currentRank: "",
      },
    };

    // Add 3 hard-mode bots
    for (let i = 1; i <= 3; i++) {
      const bot = new BotPlayer(
        `bot-${uuidv4()}`,
        `Master Bot ${i}`,
        "advanced"
      );
      // botStrategy.setEmitFunction((msg) => {
      //   io.to(roomId).emit("botMessage", {
      //     botId: bot.id,
      //     text: msg,
      //   });
      // });
      rooms[roomId].clients.push({
        id: bot.id,
        isBot: true,
        botInstance: bot,
      });
      rooms[roomId].playerCards[bot.id] = [];
      roomCounts[roomId]++;
    }
  }

  socket.join(roomId);
  const humanExists = rooms[roomId].clients.some((c) => c.id === socket.id);

  if (!humanExists) {
    rooms[roomId].clients.push({
      id: socket.id,
      socket: socket,
      isBot: false,
    });
    rooms[roomId].playerCards[socket.id] = [];
    roomCounts[roomId]++;
  }

  // If the room reaches its capacity, emit a message to restrict further entry
  if (roomCounts[roomId] >= roomCapacity) {
    io.to(roomId).emit("STOC-SET-NUMBER-OF-PLAYERS", roomCapacity);
    assignTurns(roomId);

    setTimeout(() => {
      if (!rooms[roomId]) return;
      serverfn.delayedCode(
        rooms[roomId].cardset,
        roomCapacity,
        rooms[roomId].clients,
        rooms,
        roomId
      );

      rooms[roomId].gameState.players = rooms[roomId].clients.map((client) => ({
        id: client.id,
        cardCount: rooms[roomId].playerCards[client.id]?.length || 0,
      }));
    }, 4000);
    // Execute something else during the 2-second delay
    executeDuringDelay(roomId);
    rooms[roomId].currentTurnIndex = -1;
    rooms[roomId].raiseActionDone = true;
    setTimeout(() => {
      changeTurn(roomId);
    }, 6000);
  }
  function executeDuringDelay(roomId) {
    io.to(roomId).emit("STOC-SHUFFLING", "shuffle");
  }

  socket.on("CTOS-PLACE-CARD", (selectedCards, bluff_text, remainingCards) => {
    lastPlayedCardCount = selectedCards.length;
    rooms[roomId].playinguserfail = false;

    // Remove selected cards
    rooms[roomId].playerCards[socket.id] = rooms[roomId].playerCards[
      socket.id
    ].filter(
      (card) =>
        !selectedCards.some(
          (sel) => sel.suit === card.suit && sel.value === card.value
        )
    );

    rooms[roomId].gameState.players = rooms[roomId].clients.map((client) => ({
      id: client.id,
      cardCount: rooms[roomId].playerCards[client.id]?.length || 0,
    }));

    selectedCards.forEach((card) => {
      rooms[roomId].SuitStack.push(card.suit);
      rooms[roomId].CardStack.push(card.value);
      rooms[roomId].gameState.discardPile.push(card);
    });

    if (remainingCards == 0) {
      rooms[roomId].playerGoingToWin = rooms[roomId].currentTurnIndex;
    }

    rooms[roomId].raiseActionDone = false;
    io.to(roomId).emit("STOC-RAISE-TIME-START");
    io.to(roomId).emit("STOC-CHOOSE-EMOJI", socket.id);

    if (rooms[roomId].raiseTimer) {
      clearTimeout(rooms[roomId].raiseTimer);
    }

    setTimeout(() => {
      rooms[roomId].raiseTimer = setTimeout(() => {
        if (!rooms[roomId].raiseActionDone) {
          io.to(roomId).emit("STOC-RAISE-TIME-OVER");
          rooms[roomId].raiseActionDone = true;
          changeTurn(roomId);
        }
      }, 15000);
    }, 5000);

    if (rooms[roomId].newGame) {
      rooms[roomId].bluff_text = bluff_text;
      rooms[roomId].gameState.currentRank = bluff_text;
      rooms[roomId].newGame = false;
    }

    rooms[roomId].gameState.lastAction = {
      type: "place",
      playerId: socket.id,
      bluffText: rooms[roomId].bluff_text,
      cards: selectedCards,
      wasSuccessful: null,
    };

    io.to(roomId).emit(
      "STOC-GAME-PLAYED",
      lastPlayedCardCount,
      rooms[roomId].bluff_text,
      rooms[roomId].currentTurnIndex
    );
  });

  socket.on("CTOS-RAISE", () => {
    const room = rooms[roomId];
    const raiserPos = room.clients.findIndex((c) => c.id === socket.id);
    const blufferPos = room.clients.findIndex(
      (c) => c.id === room.gameState.lastAction.playerId
    );

    if (raiserPos === blufferPos) {
      socket.emit("ERROR", "You cannot raise yourself.");
      return;
    }

    handleRaise(roomId, raiserPos);
  });

  socket.on("CTOS-PASS", (pos) => {
    rooms[roomId].passedPlayers.push(pos);
    io.to(roomId).emit("STOC-GAME-PLAYED", 0, rooms[roomId].bluff_text);
    rooms[roomId].gameState.lastAction = {
      type: "pass",
      playerId: socket.id,
      bluffText: "",
      wasSuccessful: null,
    };

    if (
      rooms[roomId].passedPlayers.length ===
      rooms[roomId].clients.length - rooms[roomId].wonUsers.length
    ) {
      rooms[roomId].CardStack = [];
      rooms[roomId].SuitStack = [];
      rooms[roomId].gameState.discardPile = [];
      io.to(roomId).emit("STOC-PLAY-OVER");
      rooms[roomId].passedPlayers.length = 0;
      rooms[roomId].newGame = true;
      setTimeout(() => {
        const prevPos =
          (pos - 1 + rooms[roomId].clients.length) %
          rooms[roomId].clients.length;
        changeTurn(roomId, prevPos);
      }, 5000);
    } else {
      changeTurn(roomId);
    }
  });

  socket.on("disconnect", () => {
    const room = rooms[roomId];
    if (!room) return;

    console.log("User disconnected:", socket.id);
    room.clients = room.clients.filter((c) => c.id !== socket.id);
    delete room.playerCards[socket.id];
    roomCounts[roomId]--;

    if (room.raiseTimer) {
      clearTimeout(room.raiseTimer);
      room.raiseTimer = null;
    }

    if (room.botInterval) {
      clearInterval(room.botInterval);
      room.botInterval = null;
    }

    if (room.startTimeout) {
      clearTimeout(room.startTimeout);
    }

    const humanPlayersLeft = room.clients.filter((c) => !c.isBot);
    if (humanPlayersLeft.length === 0) {
      delete roomCounts[roomId];
      delete rooms[roomId];
      return;
    }

    io.to(roomId).emit("STOC-PLAYER-LEFT", socket.id);
  });
});

async function playBotTurn(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const botSocket = room.clients[room.currentTurnIndex];
  if (!botSocket || !botSocket.isBot || !botSocket.botInstance) {
    return;
  }

  const bot = botSocket.botInstance;
  const botId = botSocket.id;

  room.gameState.players = room.clients.map((client) => ({
    id: client.id,
    cardCount: room.playerCards[client.id]?.length || 0,
  }));
  room.gameState.currentPlayerId = botId;

  try {
    const action = await bot.decideAction(room.gameState);

    if (action.type === "raise") {
      const lastPlayerIndex = room.clients.findIndex(
        (c) => c.id === room.gameState.lastAction.playerId
      );
      if (lastPlayerIndex !== -1) {
        handleRaise(roomId, room.currentTurnIndex);
      }
      return;
    }

    if (action.type === "place") {
      for (const playedCard of action.cards) {
        const index = room.playerCards[botId].findIndex(
          (c) => c.suit === playedCard.suit && c.value === playedCard.value
        );
        if (index !== -1) {
          room.playerCards[botId].splice(index, 1);
        }
      }

      action.cards.forEach((card) => {
        room.SuitStack.push(card.suit);
        room.CardStack.push(card.value);
        room.gameState.discardPile.push(card);
      });

      if (room.newGame) {
        room.bluff_text = action.bluffText;
        room.newGame = false;
        room.gameState.currentRank = action.bluffText;
      }

      room.gameState.lastAction = {
        type: "place",
        playerId: botId,
        bluffText: room.bluff_text,
        cards: action.cards,
        wasSuccessful: null,
      };

      room.lastPlayedCardCount = action.cards.length;

      io.to(roomId).emit(
        "STOC-GAME-PLAYED",
        action.cards.length,
        room.bluff_text,
        room.currentTurnIndex
      );

      room.raiseActionDone = false;

      io.to(roomId).emit("STOC-RAISE-TIME-START");

      if (room.raiseTimer) {
        clearTimeout(room.raiseTimer);
      }

      room.raiseTimer = setTimeout(() => {
        if (!room.raiseActionDone) {
          io.to(roomId).emit("STOC-RAISE-TIME-OVER");
          room.raiseActionDone = true;
          changeTurn(roomId);
        }
      }, 15000);

      return;
    }

    if (action.type === "pass") {
      room.passedPlayers.push(room.currentTurnIndex);
      io.to(roomId).emit("STOC-GAME-PLAYED", 0, room.bluff_text);

      room.gameState.lastAction = {
        type: "pass",
        playerId: botId,
        bluffText: "",
        wasSuccessful: null,
      };

      room.raiseActionDone = true;
      changeTurn(roomId);
      return;
    }
  } catch (err) {
    room.raiseActionDone = true;
    changeTurn(roomId);
  }
}

function handleRaise(roomId, raisedClientPos) {
  const room = rooms[roomId];
  room.raiseActionDone = true;

  const poppedElements = [...room.CardStack];
  const poppedSuits = [...room.SuitStack];

  let bluffFailed = false;

  const blufferId = room.gameState.lastAction.playerId;
  const blufferPos = room.clients.findIndex((c) => c.id === blufferId);
  const raiserPos = raisedClientPos;

  if (room.raiseTimer) {
    clearTimeout(room.raiseTimer);
    room.raiseTimer = null;
  }
  room.raiseActionDone = true;

  // check if bluff was wrong
  for (let i = 0; i < room.lastPlayedCardCount; i++) {
    const idxFromTop = room.CardStack.length - 1 - i;
    if (idxFromTop < 0) break;
    if (String(room.CardStack[idxFromTop]) !== String(room.bluff_text)) {
      bluffFailed = true;
      break;
    }
  }

  // loser is the one who bluffed wrongly, or the raiser if bluff was actually correct
  const loserPos = bluffFailed ? blufferPos : raiserPos;
  const loser = room.clients[loserPos];

  room.playinguserfail = bluffFailed;

  for (let i = 0; i < poppedElements.length; i++) {
    room.playerCards[loser.id].push({
      value: poppedElements[i],
      suit: poppedSuits[i],
    });
  }

  room.CardStack.length = 0;
  room.SuitStack.length = 0;

  const winnerPos = bluffFailed ? raiserPos : blufferPos;

  io.to(roomId).emit(
    "STOC-SHOW-RAISED-CARDS",
    poppedElements,
    poppedSuits,
    winnerPos,
    loserPos
  );

  setTimeout(() => {
    if (loser.isBot) {
      io.to(loser.id).emit(
        "STOC1C-DUMP-PENALTY-CARDS",
        [],
        poppedElements,
        [],
        poppedSuits
      );
    } else {
      loser.socket.emit(
        "STOC1C-DUMP-PENALTY-CARDS",
        [],
        poppedElements,
        [],
        poppedSuits
      );
    }
  }, 3000);

  room.CardStack = [];
  room.SuitStack = [];
  room.gameState.discardPile = [];
  room.passedPlayers.length = 0;
  room.newGame = true;

  room.gameState.lastAction = {
    type: "raise",
    playerId: room.clients[raisedClientPos].id,
    bluffText: "",
    wasSuccessful: !bluffFailed,
  };

  if (!bluffFailed && room.playerGoingToWin !== -1) {
    room.wonUsers.push(room.playerGoingToWin);
    io.to(roomId).emit("STOC-PLAYER-WON", room.playerGoingToWin);
    room.playerGoingToWin = -1;
  }

  // Update bot memory if either player was a bot
  room.clients.forEach((client) => {
    if (client.isBot && client.botInstance) {
      client.botInstance.updateMemoryWithChallengeResult(
        room.gameState.lastAction,
        !bluffFailed
      );
    }
  });

  // The next turn should go to the raiser if bluff failed,
  // or to the bluffer if bluff succeeded
  room.currentTurnIndex = bluffFailed ? raiserPos : blufferPos;

  setTimeout(() => {
    io.to(roomId).emit("STOC-PLAY-OVER");
  }, 3000);

  setTimeout(() => {
    changeTurn(roomId, room.currentTurnIndex);
  }, 5000);
}

function assignTurns(roomId) {
  rooms[roomId].clients.forEach((client, index) => {
    io.to(client.id).emit("STO1C-SET-POSITION", index);
  });
}

function getNextActiveIndex(room, startIndex) {
  let idx = startIndex;
  const N = room.clients.length;
  let tries = 0;

  while (room.wonUsers.includes(idx) && tries < N) {
    idx = (idx + 1) % N;
    tries++;
  }

  if (tries >= N) {
    return startIndex; // fallback
  }

  return idx;
}

function changeTurn(roomId, forceIndex = null) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.raiseActionDone === false) {
    return;
  }

  if (!room.clients.length) return;

  if (forceIndex !== null) {
    room.currentTurnIndex =
      ((forceIndex % room.clients.length) + room.clients.length) %
      room.clients.length;
  } else {
    room.currentTurnIndex =
      (((room.currentTurnIndex + 1) % room.clients.length) +
        room.clients.length) %
      room.clients.length;

    room.currentTurnIndex = getNextActiveIndex(room, room.currentTurnIndex);
  }

  const nextSocket = room.clients[room.currentTurnIndex];

  room.gameState.currentPlayerId = nextSocket.id;
  io.to(roomId).emit("STOC-SET-WHOS-TURN", room.currentTurnIndex, room.newGame);

  if (room.wonUsers.length === room.clients.length - 1) {
    io.to(roomId).emit("STOC-GAME-OVER", room.wonUsers);
    return;
  }

  if (nextSocket.isBot) {
    setTimeout(() => {
      playBotTurn(roomId);
    }, 1000);
  }
}

httpServer.listen(3000, () => {
  console.log("connected to server");
});

export { app, httpServer, io, router, rooms };
