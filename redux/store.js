import { configureStore } from "@reduxjs/toolkit";
import gameReducer from "./slice.js";

// Configure the Redux store
const store = configureStore({
  reducer: {
    game: gameReducer,
  },
});

export default store;
