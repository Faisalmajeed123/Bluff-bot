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

console.log("ROOMS", rooms);
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
    const bot = new BotPlayer(`bot-${uuidv4()}`, "Easy Bot", "beginner");
    rooms[roomId].clients.push({
      id: bot.id,
      isBot: true,
      botInstance: bot,
    });
    rooms[roomId].playerCards[bot.id] = [];
    roomCounts[roomId]++;
    console.log("==============================================", bot);
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
  // rooms[roomId].clients.push(socket);
  console.log(
    "New user joined connected with room ID: " +
      roomId +
      ", member count: " +
      roomCounts[roomId]
  );

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
    console.log("ROOMID", roomId);
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
      console.log(
        "Last played user is going to win! position : ",
        rooms[roomId].currentTurnIndex
      );
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
        wasSuccessful: null,
      };
    } else {
      // not a new round — keep existing bluff text
      rooms[roomId].gameState.lastAction = {
        type: "place",
        playerId: socket.id,
        bluffText: rooms[roomId].bluff_text,
        wasSuccessful: null,
      };
    }

    // if (rooms[roomId].newGame === true) {
    //   rooms[roomId].newGame = false;
    //   rooms[roomId].bluff_text = bluff_text;
    // }

    if (bluff_text) {
      rooms[roomId].bluff_text = bluff_text;
      rooms[roomId].gameState.currentRank = bluff_text;

      rooms[roomId].gameState.lastAction = {
        type: "place",
        playerId: socket.id,
        bluffText: bluff_text || "",
        wasSuccessful: null,
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
        // console.log("Passed players:", rooms[roomId].passedPlayers);
        // console.log("Won users:", rooms[roomId].wonUsers);
        // console.log("Current turn index:", rooms[roomId].currentTurnIndex);
      }
    }, 15000);
  });

  socket.on("CTOS-RAISE", (raisedClientPos) => {
    rooms[roomId].raiseActionDone = true;
    const poppedElements = [];
    const poppedSuits = [];
    rooms[roomId].playinguserfail = false;

    for (let i = 0; i < lastPlayedCardCount; i++) {
      if (rooms[roomId].CardStack.length > 0) {
        const poppedSuit = rooms[roomId].SuitStack.pop();
        const poppedElement = rooms[roomId].CardStack.pop();
        if (poppedElement != rooms[roomId].bluff_text) {
          console.log(
            "popped element,input",
            poppedElement,
            rooms[roomId].bluff_text
          );
          rooms[roomId].playinguserfail = true;

          const receiverSocket =
            rooms[roomId].clients[rooms[roomId].currentTurnIndex];
          rooms[roomId].playerCards[receiverSocket.id].push(
            ...rooms[roomId].CardStack,
            ...poppedElements
          );
          rooms[roomId].gameState.players = rooms[roomId].clients.map(
            (client) => ({
              id: client.id,
              cardCount: rooms[roomId].playerCards[client.id]?.length || 0,
            })
          );

          console.log("playinguserfail:", rooms[roomId].playinguserfail);
        }
        poppedElements.push(poppedElement);
        poppedSuits.push(poppedSuit);
      } else {
        break; // Stack is empty, exit the loop
      }
    }
    console.log("poppedsuits:", poppedSuits);

    if (rooms[roomId].playinguserfail) {
      rooms[roomId].playerGoingToWin = -1;
      io.to(roomId).emit(
        "STOC-SHOW-RAISED-CARDS",
        poppedElements,
        poppedSuits,
        raisedClientPos,
        rooms[roomId].currentTurnIndex
      );
      console.log("cardstackback:", rooms[roomId].CardStack);
      rooms[roomId].clients[rooms[roomId].currentTurnIndex].emit(
        "STOC1C-DUMP-PENALTY-CARDS",
        rooms[roomId].CardStack,
        poppedElements,
        rooms[roomId].SuitStack,
        poppedSuits
      );
      rooms[roomId].currentTurnIndex =
        (raisedClientPos - 1 + rooms[roomId].clients.length) %
        rooms[roomId].clients.length;
    } else {
      io.to(roomId).emit(
        "STOC-SHOW-RAISED-CARDS",
        poppedElements,
        poppedSuits,
        rooms[roomId].currentTurnIndex,
        raisedClientPos
      );
      console.log("raisedClientPos  " + raisedClientPos);
      rooms[roomId].currentTurnIndex =
        (rooms[roomId].currentTurnIndex - 1) % rooms[roomId].clients.length;
      const Openedclient = rooms[roomId].clients[raisedClientPos];
      Openedclient.emit(
        "STOC1C-DUMP-PENALTY-CARDS",
        rooms[roomId].CardStack,
        poppedElements,
        rooms[roomId].SuitStack,
        poppedSuits
      );
      if (rooms[roomId].playerGoingToWin != -1) {
        rooms[roomId].wonUsers.push(rooms[roomId].playerGoingToWin);
        io.to(roomId).emit("STOC-PLAYER-WON", rooms[roomId].playerGoingToWin);
        rooms[roomId].playerGoingToWin = -1;
      }
    }

    rooms[roomId].gameState.lastAction = {
      type: "raise",
      playerId: socket.id,
      bluffText: "",
      wasSuccessful: !rooms[roomId].playinguserfail,
    };
    rooms[roomId].CardStack = [];
    rooms[roomId].SuitStack = [];
    rooms[roomId].gameState.discardPile = [];
    rooms[roomId].passedPlayers.length = 0;
    rooms[roomId].newGame = true;

    setTimeout(() => {
      io.to(roomId).emit("STOC-PLAY-OVER");
    }, 3000);

    setTimeout(() => {
      changeTurn(roomId);
    }, 5000);
  });

  socket.on("CTOS-PASS", (pos) => {
    rooms[roomId].passedPlayers.push(pos);
    console.log(
      "PASSED PLAYER LENGTH , WON PLAYER LENGTH:",
      rooms[roomId].passedPlayers.length,
      rooms[roomId].wonUsers.length
    );
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
    console.log(
      " user disconnected with roomID:" + roomId + "member" + roomCounts[roomId]
    );
    rcount = roomCounts[roomId];
    rcount--;
    console.log("the room count is:", rcount);
    if (roomCounts[roomId] <= 0) {
      delete roomCounts[roomId];
      delete rooms[roomId];
      console.log("room ented");
    }
  });
});

async function playBotTurn(roomId) {
  const room = rooms[roomId];
  const botSocket = room.clients[room.currentTurnIndex];
  const bot = botSocket.botInstance;
  const botId = botSocket.id;

  // fill up gameState with latest info
  room.gameState.players = room.clients.map((client) => ({
    id: client.id,
    cardCount: room.playerCards[client.id]?.length || 0,
  }));
  room.gameState.currentPlayerId = botId;

  const gameState = room.gameState;

  try {
    const action = await bot.decideAction(gameState);

    console.log(`🤖 Bot ${botId} decided:`, action);

    if (action.type === "place") {
      // Remove selected cards from bot’s hand
      room.playerCards[botId] = room.playerCards[botId].filter(
        (card) =>
          !action.cards.some(
            (sel) => sel.suit === card.suit && sel.value === card.value
          )
      );

      // Update stacks
      action.cards.forEach((card) => {
        room.SuitStack.push(card.suit);
        room.CardStack.push(card.value);
        room.gameState.discardPile.push(card);
      });

      room.bluff_text = action.bluffText;
      room.newGame = false;

      room.gameState.lastAction = {
        type: "place",
        playerId: botId,
        bluffText: action.bluffText,
        wasSuccessful: null,
      };

      io.to(roomId).emit(
        "STOC-GAME-PLAYED",
        action.cards.length,
        room.bluff_text,
        room.currentTurnIndex
      );
      io.to(roomId).emit("STOC-RAISE-TIME-START");

      setTimeout(() => {
        io.to(roomId).emit("STOC-RAISE-TIME-OVER");
        changeTurn(roomId);
      }, 9000);
    } else if (action.type === "pass") {
      rooms[roomId].passedPlayers.push(room.currentTurnIndex);

      io.to(roomId).emit("STOC-GAME-PLAYED", 0, room.bluff_text);
      room.gameState.lastAction = {
        type: "pass",
        playerId: botId,
        bluffText: "",
        wasSuccessful: null,
      };

      changeTurn(roomId);
    } else if (action.type === "raise") {
      // (optional) implement raise action for bot
      console.log(`Bot ${botId} wants to raise — implement logic.`);
      changeTurn(roomId);
    }
  } catch (err) {
    console.error(`Error in bot turn:`, err);
    changeTurn(roomId);
  }
}

function assignTurns(roomId) {
  rooms[roomId].clients.forEach((client, index) => {
    io.to(client.id).emit("STO1C-SET-POSITION", index);
  });
}

function changeTurn(roomId) {
  const room = rooms[roomId];
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.clients.length;

  const nextSocket = room.clients[room.currentTurnIndex];
  const nextId = nextSocket.id;
  room.gameState.currentPlayerId = nextId;

  console.log("Updated gameState for room:", roomId, room.gameState);

  if (room.wonUsers.length === room.clients.length - 1) {
    io.to(roomId).emit("STOC-GAME-OVER", room.wonUsers);
    return;
  }

  if (nextSocket.isBot) {
    setTimeout(() => playBotTurn(roomId), 1000);
  } else {
    io.to(roomId).emit(
      "STOC-SET-WHOS-TURN",
      room.currentTurnIndex,
      room.newGame
    );
  }
}

httpServer.listen(3000, () => {
  console.log("connected to server");
});

export { app, httpServer, io, router, rooms };
