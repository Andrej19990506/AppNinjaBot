import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import SlotSettings, { SlotSettingsRef } from './index';
import ShiftTemplateSettings, { ShiftTemplateSettingsRef } from './ShiftTemplateSettings';

export interface SlotSettingsWrapperRef {
    triggerSave: () => Promise<void>;
    triggerReset: () => void;
    isDirty: boolean;
    isValid: () => boolean;
}

interface SlotSettingsWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    chatId?: number;
    dayIndex: number;
    onDayChangeRequest: (newDayIndex: number) => void;
    onDirtyChange: (isDirty: boolean) => void;
    onConfirmModalStateChange?: (isOpen: boolean, onConfirm: (() => void) | null, onCancel: (() => void) | null) => void;
}

const SlotSettingsWrapper: React.ForwardRefRenderFunction<SlotSettingsWrapperRef, SlotSettingsWrapperProps> = ({
    isOpen,
    onClose,
    chatId,
    dayIndex,
    onDayChangeRequest,
    onDirtyChange,
    onConfirmModalStateChange
}, ref) => {
    const [useNewInterface, setUseNewInterface] = useState(true); // По умолчанию используем новый интерфейс
    
    const slotSettingsRef = useRef<SlotSettingsRef>(null);
    const shiftTemplateSettingsRef = useRef<ShiftTemplateSettingsRef>(null);

    useImperativeHandle(ref, () => ({
        triggerSave: async () => {
            if (useNewInterface) {
                return await shiftTemplateSettingsRef.current?.triggerSave() || Promise.resolve();
            } else {
                return await slotSettingsRef.current?.triggerSave() || Promise.resolve();
            }
        },
        triggerReset: () => {
            if (useNewInterface) {
                shiftTemplateSettingsRef.current?.triggerReset();
            } else {
                slotSettingsRef.current?.triggerReset();
            }
        },
        isDirty: useNewInterface ? (shiftTemplateSettingsRef.current?.isDirty || false) : (slotSettingsRef.current?.isDirty || false),
        isValid: () => {
            if (useNewInterface) {
                return shiftTemplateSettingsRef.current?.isValid() || false;
            } else {
                return slotSettingsRef.current?.isValid() || false;
            }
        }
    }), [useNewInterface]);

    if (!isOpen) return null;

    return (
        <>
            {useNewInterface ? (
                <ShiftTemplateSettings
                    ref={shiftTemplateSettingsRef}
                    isOpen={isOpen}
                    onClose={onClose}
                    chatId={chatId}
                    dayIndex={dayIndex}
                    onDayChangeRequest={onDayChangeRequest}
                    onDirtyChange={onDirtyChange}
                    onConfirmModalStateChange={onConfirmModalStateChange}
                />
            ) : (
                <SlotSettings
                    ref={slotSettingsRef}
                    isOpen={isOpen}
                    onClose={onClose}
                    chatId={chatId}
                    dayIndex={dayIndex}
                    onDayChangeRequest={onDayChangeRequest}
                    onDirtyChange={onDirtyChange}
                />
            )}
        </>
    );
};

export default forwardRef(SlotSettingsWrapper);
