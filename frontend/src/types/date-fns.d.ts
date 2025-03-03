declare module 'date-fns' {
    export function format(date: Date | number, format: string, options?: { locale?: any }): string;
    export function formatDistance(date: Date | number, baseDate: Date | number, options?: { locale?: any }): string;
    export function formatRelative(date: Date | number, baseDate: Date | number, options?: { locale?: any }): string;
    export function isValid(date: any): boolean;
    export function parse(dateString: string, formatString: string, baseDate: Date | number, options?: { locale?: any }): Date;
    export function parseISO(argument: string, options?: { additionalDigits?: 0 | 1 | 2 }): Date;
}

declare module 'date-fns/locale' {
    export const ru: any;
    export const enUS: any;
} 