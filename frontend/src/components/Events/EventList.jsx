import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchEvents, selectAllEvents, selectEventsLoading, selectEventsError } from '../../store/slices/eventsSlice';
import EventItem from './EventItem';
import EmptyEventList from './EmptyEventList';

const EventList = () => {
    const dispatch = useAppDispatch();
    const events = useAppSelector(selectAllEvents);
    const loadingStatus = useAppSelector(selectEventsLoading);
    const error = useAppSelector(selectEventsError);

    useEffect(() => {
        if (loadingStatus === 'idle') {
            dispatch(fetchEvents());
        }
    }, [loadingStatus, dispatch]);

    const handleDelete = async (id) => {
        console.warn('handleDelete needs to be updated for Redux state management');
    };

    const renderContent = () => {
        if (loadingStatus === 'pending' || loadingStatus === 'idle') {
            return (
                <div className="loadingContainer">
                    <div className="loading">Загрузка событий...</div>
                </div>
            );
        }

        if (loadingStatus === 'failed') {
            return (
                <div className="errorContainer">
                    <div className="error">Ошибка загрузки: {error || 'Неизвестная ошибка'}</div>
                </div>
            );
        }

        if (!events || events.length === 0) {
            return (
                <div className="emptyStateContainer">
                    <EmptyEventList />
                </div>
            );
        }

        return (
            <div className="eventList">
                {events.map((event) => (
                    <EventItem
                        key={event.id}
                        event={event}
                        onDelete={handleDelete}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="container">
            {renderContent()}
        </div>
    );
};

export default EventList;
