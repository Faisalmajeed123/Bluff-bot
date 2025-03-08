import { createSlice } from "@reduxjs/toolkit";

// Initial game state
const initialState = {
  currentTurn: "Player", // Start with Player
  botMoves: {}, // Track bot moves
  round: 1,
};

// Redux Slice for game state
const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    setNextTurn: (state, action) => {
      state.currentTurn = action.payload;
    },
    recordBotMove: (state, action) => {
      const { botId, move } = action.payload;
      state.botMoves[botId] = move;
    },
    nextRound: (state) => {
      state.round += 1;
      state.currentTurn = "Player"; // Reset to player at the start of a new round
      state.botMoves = {}; // Clear bot moves for a new round
    },
  },
});

// Export actions
export const { setNextTurn, recordBotMove, nextRound } = gameSlice.actions;
export default gameSlice.reducer;
