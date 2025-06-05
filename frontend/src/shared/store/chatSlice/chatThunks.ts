import { createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import config from '../../../config';
import { ChatWithContext, ChatContext } from './chatTypes';

export const fetchChats = createAsyncThunk(
    'chats/fetchChats',
    async (context?: ChatContext) => {
        let url = `${config.API_URL}/chats`;
        if (context) {
            url += `?context=${context}`;
        }
        const response = await axios.get<ChatWithContext[]>(url);
        console.log('✅ Получены данные:', response.data);
        return {
            chats: response.data,
            context
        };
    }
);

export const updateChatInventory = createAsyncThunk(
    'chats/updateInventory',
    async ({ chatId, inventory }: { chatId: string; inventory: any }) => {
        const response = await axios.put(`${config.API_URL}/inventory/${chatId}`, inventory);
        return { chatId, inventory: response.data };
    }
);
