var express = require("express");
var app = express();
var http = require("http").createServer(app);
var io = require("socket.io")(http);
var serverfn = require("./helpers/ServerFunctions");
var path = require("path");
const hbs = require("hbs");
// Set up the view engine to use HBS
app.set("view engine", "hbs");
// Set the location of the views directory
app.set("views", __dirname + "/views");
app.use(express.static(path.join(__dirname, "public")));
var Deck = require("./helpers/deck");
const { Socket } = require("socket.io");
const { TIMEOUT } = require("dns");
var router = express.Router();
const CardDeck = new Deck.Deck();
const { v4: uuidv4 } = require("uuid");
const rooms = {};

console.log("ROOMS", rooms);
app.get("/", (req, res) => {
  res.render("game");
});
var rcount;
const roomCapacity = 2; //set roomcapacity
const roomCounts = {};
io.on("connection", (socket) => {
  console.log("New connection established. User connected with ID:", socket.id);
  // Find or create a room with available capacity
  let roomId;
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
      currentTurnIndex: -1, // Index of the current turn player
      playinguserfail: false,
      newGame: true,
      bluff_text: undefined,
      raiseActionDone: false,
      cardset: CardDeck.cards,
    };
  }
  // so first it will find available room if not then it will create new room in [] of rooms in which there
  // will be objects of room id and each object will have these properties.

  // Join the room
  socket.join(roomId);
  rooms[roomId].clients.push(socket);
  roomCounts[roomId]++; // Increment the room count
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
        rooms[roomId].clients
      );
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
    selectedCards.forEach((card) => {
      rooms[roomId].SuitStack.push(card.suit);
      rooms[roomId].CardStack.push(card.value);
    });

    console.log("value:", rooms[roomId].CardStack);
    console.log("suit:", rooms[roomId].SuitStack);
    console.log("remainingCards:", remainingCards);
    if (remainingCards == 0) {
      console.log(
        "Last played user is going to win! position : ",
        rooms[roomId].currentTurnIndex
      );
      rooms[roomId].playerGoingToWin = rooms[roomId].currentTurnIndex;
    }

    rooms[roomId].raiseActionDone = false;
    var clientPlaying = socket.id;
    if (rooms[roomId].newGame === true) {
      rooms[roomId].newGame = false;
      rooms[roomId].bluff_text = bluff_text;
    }
    console.log("input:", rooms[roomId].bluff_text);
    io.to(roomId).emit(
      "STOC-GAME-PLAYED",
      lastPlayedCardCount,
      rooms[roomId].bluff_text
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
        (raisedClientPos - 1) % rooms[roomId].clients.length;
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
    rooms[roomId].CardStack = [];
    rooms[roomId].SuitStack = [];
    console.log("THIS OVER");
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
    if (
      rooms[roomId].passedPlayers.length ===
      rooms[roomId].clients.length - rooms[roomId].wonUsers.length
    ) {
      rooms[roomId].CardStack = [];
      rooms[roomId].SuitStack = [];
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
    rcount--; // Decrement the room count
    console.log("the room count is:", rcount);
    if (roomCounts[roomId] <= 0) {
      delete roomCounts[roomId]; // Remove the room if there are no more users
      console.log("room ented");
    }
  });
});

function assignTurns(roomId) {
  // Emit the turn order to each client
  rooms[roomId].clients.forEach((client, index) => {
    client.emit("STO1C-SET-POSITION", index);
  });
}
// Decide which player will have first move

function changeTurn(roomId) {
  rooms[roomId].currentTurnIndex =
    (rooms[roomId].currentTurnIndex + 1) % rooms[roomId].clients.length;
  console.log("passedPlayers : ", rooms[roomId].passedPlayers);
  console.log("wonUsers : ", rooms[roomId].wonUsers);
  if (rooms[roomId].wonUsers.length === rooms[roomId].clients.length - 1) {
    console.log("Game Over");
    io.to(roomId).emit("STOC-GAME-OVER", rooms[roomId].wonUsers);
  } else {
    if (
      rooms[roomId].passedPlayers.includes(rooms[roomId].currentTurnIndex) ||
      rooms[roomId].wonUsers.includes(rooms[roomId].currentTurnIndex)
    ) {
      changeTurn(roomId);
    } else {
      io.to(roomId).emit(
        "STOC-SET-WHOS-TURN",
        rooms[roomId].currentTurnIndex,
        rooms[roomId].newGame
      );
    }
  }
}

http.listen(3000, () => {
  console.log("connected to server");
});
