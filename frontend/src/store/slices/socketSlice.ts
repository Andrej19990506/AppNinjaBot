import { createSlice } from '@reduxjs/toolkit';

interface SocketState {
  isConnected: boolean;
}

const initialState: SocketState = {
  isConnected: false,
};

const socketSlice = createSlice({
  name: 'socket',
  initialState,
  reducers: {
    socketConnected(state) {
      state.isConnected = true;
    },
    socketDisconnected(state) {
      state.isConnected = false;
    },
  },
});

export const { socketConnected, socketDisconnected } = socketSlice.actions;
export default socketSlice.reducer; 