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
const roomCapacity = 2; //set roomcapacity
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
    roomCounts[roomId] = 0; // Initialize the room count
    rooms[roomId] = {
      clients: [], // Array of sockets in the room
      CardStack: [], // Card stack specific to the room
      SuitStack: [], // Suit stack specific to the room
      passedPlayers: [],
      playerGoingToWin: -1,
      wonUsers: [],
      // Add other room-specific variables as needed
      lastPlayedCardCount: undefined,
      currentTurnIndex: 1, // Index of the current turn player(change this to shift first user turns)
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

    // Bot players
    const bot = new BotPlayer(`bot-${uuidv4()}`, "Easy Bot", "advanced");
    rooms[roomId].clients.push({
      id: bot.id,
      isBot: true,
      botInstance: bot,
    });
    rooms[roomId].playerCards[bot.id] = [];
    roomCounts[roomId]++;
  }

  socket.join(roomId);

  // make sure we only add the human ONCE
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
    setTimeout(() => {
      changeTurn(roomId, io);
    }, 5000);
  }
  function executeDuringDelay(roomId) {
    io.to(roomId).emit("STOC-SHUFFLING", "shuffle");
  }

  socket.on("CTOS-PLACE-CARD", (selectedCards, bluff_text, remainingCards) => {
    lastPlayedCardCount = selectedCards.length;
    rooms[roomId].playinguserfail = false;

    // Remove selected cards from player's hand
    rooms[roomId].playerCards[socket.id] = rooms[roomId].playerCards[
      socket.id
    ].filter(
      (card) =>
        !selectedCards.some(
          (sel) => sel.suit === card.suit && sel.value === card.value
        )
    );

    // Update card counts
    rooms[roomId].gameState.players = rooms[roomId].clients.map((client) => ({
      id: client.id,
      cardCount: rooms[roomId].playerCards[client.id]?.length || 0,
    }));

    selectedCards.forEach((card) => {
      rooms[roomId].SuitStack.push(card.suit);
      rooms[roomId].CardStack.push(card.value);

      rooms[roomId].gameState.discardPile.push({
        suit: card.suit,
        value: card.value,
      });
    });

    if (remainingCards == 0) {
      rooms[roomId].playerGoingToWin = rooms[roomId].currentTurnIndex;
    }

    rooms[roomId].raiseActionDone = false;
    // var clientPlaying = socket.id;
    if (rooms[roomId].newGame === true) {
      // first move of the round, set bluff text
      rooms[roomId].bluff_text = bluff_text;
      rooms[roomId].gameState.currentRank = bluff_text;
      rooms[roomId].newGame = false;
      rooms[roomId].gameState.lastAction = {
        type: "place",
        playerId: socket.id,
        bluffText: bluff_text || "",
        cards: selectedCards,
        wasSuccessful: null,
      };
    } else {
      // not a new round — keep existing bluff text
      rooms[roomId].gameState.lastAction = {
        type: "place",
        playerId: socket.id,
        bluffText: rooms[roomId].bluff_text,
        cards: selectedCards,
        wasSuccessful: null,
      };
    }

    if (bluff_text) {
      rooms[roomId].bluff_text = bluff_text;
      rooms[roomId].gameState.currentRank = bluff_text;

      rooms[roomId].gameState.lastAction = {
        type: "place",
        playerId: socket.id,
        bluffText: bluff_text || "",
        wasSuccessful: null,
        cards: selectedCards,
      };
    }

    io.to(roomId).emit(
      "STOC-GAME-PLAYED",
      lastPlayedCardCount,
      rooms[roomId].bluff_text,
      rooms[roomId].currentTurnIndex
    );
    io.to(roomId).emit("STOC-RAISE-TIME-START");
    setTimeout(() => {
      if (rooms[roomId].playerGoingToWin != -1) {
        rooms[roomId].wonUsers.push(rooms[roomId].playerGoingToWin);
        io.to(roomId).emit("STOC-PLAYER-WON", rooms[roomId].playerGoingToWin);
        rooms[roomId].playerGoingToWin = -1;
      }
      if (!rooms[roomId].raiseActionDone) {
        io.to(roomId).emit("STOC-RAISE-TIME-OVER");
        changeTurn(roomId, io);
      }
    }, 15000);
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
        pos = (pos - 1) % rooms[roomId].clients.length;
        rooms[roomId].currentTurnIndex = pos;
        changeTurn(roomId);
      }, 5000);
    } else {
      changeTurn(roomId);
    }
  });

  socket.on("disconnect", () => {
    rcount = roomCounts[roomId];
    rcount--;
    if (roomCounts[roomId] <= 0) {
      delete roomCounts[roomId];
      delete rooms[roomId];
    }
  });
});

async function playBotTurn(roomId) {
  const room = rooms[roomId];
  if (!room) {
    console.error(`Room ${roomId} does not exist.`);
    return;
  }

  const botSocket = room.clients[room.currentTurnIndex];
  if (!botSocket || !botSocket.isBot || !botSocket.botInstance) {
    console.error(
      `Bot turn called but current player is not a bot.`,
      botSocket
    );
    changeTurn(roomId);
    return;
  }

  const bot = botSocket.botInstance;
  const botId = botSocket.id;

  // Set current player in game state
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
        const raiserPos = room.currentTurnIndex;
        handleRaise(roomId, raiserPos);
      } else {
        console.error("Could not find player to raise against.");
        changeTurn(roomId);
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
        } else {
          console.warn(`Bot tried to play card it doesn’t have:`, playedCard);
        }
      }

      // Update stacks
      action.cards.forEach((card) => {
        room.SuitStack.push(card.suit);
        room.CardStack.push(card.value);
        room.gameState.discardPile.push(card);
      });

      // If this starts a new round, set bluff_text
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
      setTimeout(() => {
        if (!room.raiseActionDone) {
          io.to(roomId).emit("STOC-RAISE-TIME-OVER");
          changeTurn(roomId);
        }
      }, 9000);

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

      changeTurn(roomId);
      return;
    }

    console.warn(`Bot ${botId} returned unknown action type:`, action.type);
    changeTurn(roomId);
  } catch (err) {
    console.error(`Error during bot turn:`, err);
    changeTurn(roomId);
  }
}

function handleRaise(roomId, raisedClientPos) {
  const room = rooms[roomId];
  room.raiseActionDone = true;

  const poppedElements = [];
  const poppedSuits = [];
  let bluffFailed = false;

  const blufferId = room.gameState.lastAction.playerId;
  const blufferPos = room.clients.findIndex((c) => c.id === blufferId);
  const raiserPos = raisedClientPos;

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

  while (room.CardStack.length > 0) {
    const value = room.CardStack.pop();
    const suit = room.SuitStack.pop();
    poppedElements.push(value);
    poppedSuits.push(suit);

    room.playerCards[loser.id].push({ value, suit });
  }

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
  }, 4000);

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

  // The next turn should go to the raiser if bluff failed,
  // or to the bluffer if bluff succeeded
  room.currentTurnIndex = bluffFailed ? blufferPos : raiserPos;

  setTimeout(() => {
    io.to(roomId).emit("STOC-PLAY-OVER");
  }, 3000);

  setTimeout(() => {
    changeTurn(roomId);
  }, 5000);
}

function assignTurns(roomId) {
  rooms[roomId].clients.forEach((client, index) => {
    io.to(client.id).emit("STO1C-SET-POSITION", index);
  });
}

function changeTurn(roomId) {
  const room = rooms[roomId];

  if (!room) {
    console.error(`Room ${roomId} not found`);
    return;
  }

  const prevTurn = room.currentTurnIndex;
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.clients.length;
  const nextSocket = room.clients[room.currentTurnIndex];
  const nextId = nextSocket.id;
  room.gameState.currentPlayerId = nextId;
  io.to(roomId).emit("STOC-SET-WHOS-TURN", room.currentTurnIndex, room.newGame);

  if (room.wonUsers.length === room.clients.length - 1) {
    io.to(roomId).emit("STOC-GAME-OVER", room.wonUsers);
    return;
  }

  if (nextSocket.isBot) {
    playBotTurn(roomId);
  }
}

httpServer.listen(3000, () => {
  console.log("connected to server");
});

export { app, httpServer, io, router, rooms };
