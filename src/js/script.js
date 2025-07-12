var pos;
var whosTurn;
var newGame;
let cards;
let numberOfPlayers;
let containerCount = 0;
let listenNodeInserted = false;
let childrensArray = [];

let nameOfBots = [
  "Sebastian",
  "Isabella",
  "Alexander",
  "Caldwell",
  "Maximilian",
  "Cassandra",
  "Theodore",
  "Penelope",
  "Dominic",
  "Hartley",
];

const totalPlayers = 4;
whosTurn = Array.from({ length: totalPlayers }, (_, i) => i);

const playerNames = [];
const usedNames = [];

function getUniqueBotName() {
  const availableNames = nameOfBots.filter((name) => !usedNames.includes(name));
  const randomIndex = Math.floor(Math.random() * availableNames.length);
  const name = availableNames[randomIndex];
  usedNames.push(name);
  return name;
}

for (let i = 0; i < totalPlayers; i++) {
  if (i === totalPlayers - 1) {
    playerNames.push("Me");
  } else {
    playerNames.push(getUniqueBotName());
  }
}

var lastGameCardCount = 0;
var lastGameBluffText = "Nothing";
var socket = io();
const audioFilesAddress = "http://" + location.host + "/src/assets/";

var audioRaiseTime = new Audio(audioFilesAddress + "rise-time.mp3");
var audioCardsShuffling = new Audio(audioFilesAddress + "cards-shuffling.mp3");
var audioCardsPlaced = new Audio(audioFilesAddress + "cards-placed.mp3");
var audioCardsRaised = new Audio(audioFilesAddress + "cards-raised.mp3");

function notifyScreenReader(text, priority) {
  var el = document.createElement("div");
  var id = "speak-" + Date.now();
  el.setAttribute("id", id);
  el.setAttribute("aria-live", priority || "polite");
  document.body.appendChild(el);

  window.setTimeout(function () {
    document.getElementById(id).innerHTML = text;
  }, 2000);

  window.setTimeout(function () {
    document.body.removeChild(document.getElementById(id));
  }, 10000);
}

const playedContainer = document.getElementById("container_played");
const observer = new MutationObserver((mutations, obs) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1 && !node.hasAttribute("processed")) {
        node.setAttribute("processed", "true");
        const card_id = node.id;
        node.setAttribute("tabindex", "0");

        // Initialize selected flag
        node.selected = false;

        // Toggle logic shared between key and click
        const toggleSelection = () => {
          node.selected = !node.selected;

          if (node.selected) {
            notifyScreenReader(card_id + " Selected");
            node.setAttribute("title", "Selected");
            node.style.backgroundColor = "#81ea74";
          } else {
            notifyScreenReader(card_id + " Removed");
            node.setAttribute("title", "Unselected");
            node.style.backgroundColor = "#b963ee";
          }
        };

        // ENTER key support
        node.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            toggleSelection();
          }
        });

        // CLICK support
        node.addEventListener("click", () => {
          toggleSelection();
        });
      }
    });
  });
});

const card_container = document.getElementById("card-container");
if (card_container) {
  observer.observe(card_container, { childList: true });
}

document.addEventListener("keydown", (event) => {
  // Pass
  if (event.key.toLowerCase() === ";") {
    if (document.getElementById("pass-btn").disabled == true) {
      notifyScreenReader("Pass not possible");
    } else {
      document.getElementById("pass-btn").click();
    }
  }
  // Raise
  else if (event.key.toLowerCase() === "f") {
    if (document.getElementById("raise-btn").disabled == true) {
      notifyScreenReader("Raise not possible");
    } else {
      document.getElementById("raise-btn").click();
    }
  }
  // Place
  else if (event.key.toLowerCase() === "j") {
    if (document.getElementById("place-btn").disabled == true) {
      notifyScreenReader("Place not possible");
    } else {
      document.getElementById("place-btn").click();
    }
  } else if (event.key.toLowerCase() === "[") {
    card_container.firstChild.focus();
  } else if (event.key.toLowerCase() === "]") {
    card_container.lastChild.focus();
  }
  // Say selected cards
  else if (event.key.toLowerCase() === ".") {
    var messageSelectedCards = "Selected cards : ";
    for (var i = 0; i < card_container.children.length; i++) {
      if (card_container.children[i].selected == true) {
        messageSelectedCards = messageSelectedCards.concat(
          card_container.children[i].textContent + " "
        );
      }
    }
    notifyScreenReader(messageSelectedCards);
  }
  // Say last game
  else if (event.key.toLowerCase() === "z") {
    var turnMessage = "Current Player : " + (whosTurn + 1);
    if (pos == whosTurn) {
      turnMessage = "Your turn!";
    }
    if (playedContainer.children.length == 0) {
      notifyScreenReader("Nothing played!" + turnMessage);
    } else {
      var messageSelectedCards =
        "Last played " +
        lastGameCardCount +
        " cards as " +
        lastGameBluffText +
        " Total played cards : " +
        playedContainer.children.length +
        turnMessage;
      notifyScreenReader(messageSelectedCards);
    }
  }
  // Say all cards as set cards
  else if (event.key.toLowerCase() === "0") {
    var cardsInfo = "Cards in hand : ";
    var currentCard = card_container.children[0].textContent.slice(1);
    var cardCount = 1;
    for (var i = 1; i < card_container.children.length; i++) {
      if (card_container.children[i].textContent.slice(1) == currentCard) {
        cardCount = cardCount + 1;
      } else {
        cardsInfo = cardsInfo.concat(cardCount + "," + currentCard + ", ");
        var currentCard = card_container.children[i].textContent.slice(1);
        var cardCount = 1;
      }
    }

    if (cardCount) {
      cardsInfo = cardsInfo.concat(cardCount + "-" + currentCard + ".");
    }

    notifyScreenReader(cardsInfo);
  }

  return true;
});

socket.on("STO1C-SET-POSITION", (index) => {
  pos = index;
  var player = document.getElementById(`user${pos}`);
  if (player) {
    player.innerHTML = "";
    player.innerText = "Me";
    notifyScreenReader("You are in position : " + (index + 1), "polite");
  }
});

socket.on("STOC-SET-NUMBER-OF-PLAYERS", (total) => {
  numberOfPlayers = total;
  const playerContainer = document.getElementById("player-container");
  playerContainer.innerHTML = "";
  for (let i = 0; i < numberOfPlayers; i++) {
    playerContainer.innerHTML += `<div class="user p-1" tabindex="0"><i class="far fa-user"></i><span id="user${i}">${playerNames[i]}</span></div>`;
  }
});

function startShufflingEffect() {
  // Get the card container element
  const cardContainer = document.getElementById("card-container");
  // Create loading animation and text elements
  const loadingAnimation = document.createElement("div");
  loadingAnimation.classList.add("loading-animation");
  const textElement = document.createElement("div");
  textElement.classList.add("text-element");
  textElement.classList.add("col-12");

  textElement.textContent = "Card is shuffling";
  // Append loading animation and text elements to the card container
  cardContainer.innerHTML = "";
  cardContainer.appendChild(loadingAnimation);

  cardContainer.appendChild(textElement);
  // Remove loading animation and text elements after 4 seconds
  setTimeout(() => {
    cardContainer.innerHTML = "";
    audioCardsShuffling.play();
  }, 3000);
}

socket.on("STOC-SHUFFLING", (data) => {
  notifyScreenReader("Card is shuffling!");
  startShufflingEffect();
});

function get_value(item) {
  if (item === "A") return 1;
  else if (item === "J") return 11;
  else if (item === "Q") return 12;
  else if (item === "K") return 13;
  else return parseInt(item);
}

function sort_cards(container_id) {
  var childrens = document.getElementById(container_id).children;
  childrensArray = Array.prototype.slice.call(childrens, 0);

  childrensArray.sort(function (a, b) {
    // Slice() is used instead [1] to get input '10'
    var aord = a.textContent.slice(1);
    var bord = b.textContent.slice(1);
    var a = get_value(aord);
    var b = get_value(bord);
    return a - b;
  });

  var parent = document.getElementById(container_id);
  parent.innerHTML = "";

  for (var i = 0, l = childrensArray.length; i < l; i++) {
    parent.appendChild(childrensArray[i]);
  }
}

socket.on("STO1C-DRAW-CARDS", (subpartition) => {
  cards = subpartition;
  const playerCards = subpartition;
  const cardContainer = document.getElementById("card-container");
  cardContainer.innerHTML = "";

  playerCards.forEach((card) => {
    const newCard = document.createElement("div");
    newCard.className = "col-4 col-sm-2 col-lg-1 offset-lg-0 cards ";
    newCard.id = card.suit + card.value;
    newCard.setAttribute("tabindex", "1");
    newCard.setAttribute("role", "button");
    newCard.setAttribute("title", "Unselected");
    newCard.selected = false;
    newCard.style.backgroundColor = "#b963ee";
    newCard.style.fontSize = "xxx-large";
    newCard.style.textAlign = "center";
    newCard.textContent = card.suit + card.value;

    cardContainer.appendChild(newCard);
    // handleOnCards(card.suit, card.value);
  });

  sort_cards("card-container");
  notifyScreenReader("Cards received!", "assertive");
});

socket.on("STOC-SET-WHOS-TURN", async (value, value2) => {
  whosTurn = value;
  newGame = value2;

  for (let i = 0; i < numberOfPlayers; i++) {
    const player = document.getElementById(`user${i}`);
    player.style.backgroundColor = i === whosTurn ? "#90EE90" : "#FFCCCB";
  }

  const passBtn = document.getElementById("pass-btn");
  const placeBtn = document.getElementById("place-btn");
  let messageWhosTurn = newGame ? "New Round! " : "";

  if (whosTurn === pos) {
    placeBtn.disabled = false;
    passBtn.disabled = false;
    messageWhosTurn += "It's your turn!";
  } else if (whosTurn !== pos) {
    placeBtn.disabled = true;
    passBtn.disabled = true;
    messageWhosTurn += `It's ${playerNames[whosTurn]} turn!`;
  }

  notifyScreenReader(messageWhosTurn, "assertive");
});

function placeCards() {
  var cardContainer = document.getElementById("card-container");
  var numberOfCardsInDeck = cardContainer.children.length;

  if (newGame === true) {
    var bluff_text = prompt("Please enter bluff text", "");
    if (bluff_text == null) {
      notifyScreenReader("Canceled!");
      return;
    }
    bluff_text = bluff_text.toUpperCase();
    if (
      [
        "A",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "J",
        "Q",
        "K",
      ].indexOf(bluff_text) == -1
    ) {
      notifyScreenReader("Wrong bluff text! Please bluff with card name!");
      return;
    }
  }

  var selectedCards = [];
  for (var i = cardContainer.children.length - 1; i >= 0; i--) {
    if (cardContainer.children[i].selected == true) {
      const cardObject = {
        suit: cardContainer.children[i].textContent.slice(0, 1),
        value: cardContainer.children[i].textContent.slice(1),
      };
      selectedCards.push(cardObject);
      cardContainer.removeChild(cardContainer.children[i]);
    }
  }

  if (selectedCards.length == 0) {
    notifyScreenReader("Nothing selected!");
    return;
  }

  var cards_remaining = numberOfCardsInDeck - selectedCards.length;
  socket.emit("CTOS-PLACE-CARD", selectedCards, bluff_text, cards_remaining);
  document.getElementById("place-btn").disabled = true;
  document.getElementById("raise-btn").disabled = true;
  notifyScreenReader("Cards placed!", "assertive");
}

socket.on("STOC-RAISE-TIME-START", () => {
  const raiseBtn = document.getElementById("raise-btn");
  const passBtn = document.getElementById("pass-btn");

  // If bot placed cards → raise enabled, pass disabled
  // If human placed cards → both disabled
  if (whosTurn !== pos) {
    raiseBtn.disabled = false;
    passBtn.disabled = true;
  } else {
    raiseBtn.disabled = true;
    passBtn.disabled = true;
  }

  notifyScreenReader("Raise time starts!", "assertive");

  const areaRaiseSpinner = document.getElementById("rise-spinner-area");
  const raiseSpinner = document.createElement("div");
  raiseSpinner.classList.add("loader");
  areaRaiseSpinner.appendChild(raiseSpinner);

  audioRaiseTime.loop = true;
  audioRaiseTime.play();
});

socket.on("STOC-RAISE-TIME-OVER", () => {
  audioRaiseTime.pause();
  audioRaiseTime.currentTime = 0;
  const raiseBtn = document.getElementById("raise-btn");
  raiseBtn.disabled = true;
  notifyScreenReader("Raise time over!", "assertive");
  const areaRaiseSpinner = document.getElementById("rise-spinner-area");
  areaRaiseSpinner.innerHTML = "";
});

socket.on("STOC-GAME-PLAYED", (cardCount, bluffText, playerIndex) => {
  lastGameCardCount = cardCount;
  lastGameBluffText = bluffText;
  audioCardsPlaced.play();

  if (cardCount === 0) {
    notifyScreenReader("Passed!", "assertive");
    return;
  }

  const playingContainer = document.getElementById("container_played");
  for (let i = 1; i <= cardCount; i++) {
    const newCard = document.createElement("div");
    newCard.className = "col-4 col-sm-2 col-lg-1 offset-lg-0 cards ";
    newCard.id = bluffText;
    newCard.setAttribute("tabindex", "1");
    newCard.setAttribute("role", "button");
    newCard.setAttribute("title", "on played");
    newCard.style.fontSize = "xxx-large";
    newCard.style.textAlign = "center";
    newCard.textContent = bluffText + " ";
    playingContainer.appendChild(newCard);
  }
  const playedByName =
    playerNames?.[playerIndex] || `Player ${playerIndex + 1}`;
  const cardSpelling = cardCount === 1 ? "card" : "cards";
  notifyScreenReader(
    `${playedByName} played ${cardCount} ${cardSpelling} as ${bluffText}`,
    "assertive"
  );
});

function raisecards() {
  socket.emit("CTOS-RAISE");
  const raiseBtn = document.getElementById("raise-btn");
  raiseBtn.disabled = true;
}

socket.on(
  "STOC-SHOW-RAISED-CARDS",
  (poppedElements, poppedSuits, winner, loser) => {
    audioRaiseTime.pause();
    audioRaiseTime.currentTime = 0;
    audioCardsRaised.play();
    const playedContainer = document.getElementById("container_played");

    // 🔷 clear it safely
    playedContainer.innerHTML = "";

    // Create a new element for each popped element
    let items = "";
    poppedElements.forEach((element, index) => {
      const cardElement = document.createElement("div");
      cardElement.className = "col-4 col-sm-2 col-lg-1 offset-lg-0 cards ";
      cardElement.textContent = poppedSuits[index] + element;
      items += " " + poppedSuits[index] + element;

      cardElement.setAttribute("tabindex", "1");
      cardElement.setAttribute("role", "button");
      cardElement.setAttribute("title", "on raised");
      cardElement.style.backgroundColor = "#ff0000";
      cardElement.style.fontSize = "xxx-large";
      cardElement.style.textAlign = "center";

      playedContainer.appendChild(cardElement);
    });

    const winnerName = playerNames[winner] || `Player ${winner + 1}`;
    const loserName = playerNames[loser] || `Player ${loser + 1}`;

    const raisesCardsMessage =
      `Raised cards: ${items}. ` +
      `${winnerName} got the turn! ` +
      `${loserName} got the penalty!`;

    notifyScreenReader(raisesCardsMessage, "assertive");

    const areaRaiseSpinner = document.getElementById("rise-spinner-area");
    areaRaiseSpinner.innerHTML = "";
  }
);

socket.on(
  "STOC1C-DUMP-PENALTY-CARDS",
  (CardStack, poppedElements, SuitStack, poppedSuits) => {
    var suitsBack = [];
    var cardsGivingBack = [];
    while (poppedElements.length > 0) {
      cardsGivingBack.push(poppedElements.pop());
      suitsBack.push(poppedSuits.pop());
    }
    // Push values from stack2 to the combinedStack
    while (CardStack.length > 0) {
      cardsGivingBack.push(CardStack.pop());
      suitsBack.push(SuitStack.pop());
    }

    var items = "";
    const cardContainer = document.getElementById("card-container");
    cardsGivingBack.forEach((cardvalue, index) => {
      const newCard = document.createElement("div");
      newCard.className = "col-4 col-sm-2 col-lg-1 offset-lg-0 cards ";
      newCard.id = suitsBack[index] + cardvalue;
      newCard.setAttribute("tabindex", "1");
      newCard.setAttribute("role", "button");
      newCard.setAttribute("title", "Unselected");
      newCard.selected = false;
      newCard.textContent = suitsBack[index] + cardvalue;
      items = items + " " + suitsBack[index] + cardvalue;
      newCard.style.backgroundColor = "#ff0000";
      newCard.style.textAlign = "center";
      newCard.style.fontSize = "xxx-large";

      // Append the card to the card container;
      cardContainer.appendChild(newCard);
    });
    containerCount = cardContainer.childElementCount;
    listenNodeInserted = false;
    sort_cards("card-container");
    listenNodeInserted = true;

    notifyScreenReader("Recived penalty cards : " + items, "assertive");
  }
);

function passaction() {
  socket.emit("CTOS-PASS", pos);
  notifyScreenReader("Round Passed!");
}

socket.on("STOC-PLAY-OVER", () => {
  const playedContainer = document.getElementById("container_played");
  playedContainer.innerHTML = "";
  notifyScreenReader("Current Round Over");
});

socket.on("STOC-PLAYER-WON", (player_position) => {
  var player = document.getElementById(`user${player_position}`);
  player.parentElement.style.backgroundColor = "#97FF00";
  if (pos === player_position) {
    alert("You Won!");
  } else {
    alert("Player winned : " + (player_position + 1));
  }
});

socket.on("STOC-GAME-OVER", (wonUsers) => {
  var gameOverMessage = "Game Over! Winners are : ";
  wonUsers.forEach((winner) => {
    gameOverMessage = gameOverMessage.concat("User " + (winner + 1) + ", ");
  });
  alert(gameOverMessage);
});

window.passaction = passaction;
window.placeCards = placeCards;
window.raisecards = raisecards;

socket.on("disconnect", () => {
  console.log("User disconnected from room:");
});
