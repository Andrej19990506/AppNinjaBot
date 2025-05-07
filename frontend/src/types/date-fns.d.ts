declare module 'date-fns' {
    export function format(date: Date | number, format: string, options?: { locale?: any }): string;
    export function formatDistance(date: Date | number, baseDate: Date | number, options?: { locale?: any }): string;
    export function formatRelative(date: Date | number, baseDate: Date | number, options?: { locale?: any }): string;
    export function isValid(date: any): boolean;
    export function parse(dateString: string, formatString: string, baseDate: Date | number, options?: { locale?: any }): Date;
    export function parseISO(argument: string, options?: { additionalDigits?: 0 | 1 | 2 }): Date;
}

declare module 'date-fns/startOfWeek' {
    export default function startOfWeek(date: Date | number, options?: { weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }): Date;
}

declare module 'date-fns/addDays' {
    export default function addDays(date: Date | number, amount: number): Date;
}

declare module 'date-fns/addWeeks' {
    export default function addWeeks(date: Date | number, amount: number): Date;
}

declare module 'date-fns/getDay' {
    export default function getDay(date: Date | number): number;
}

declare module 'date-fns/format' {
    export default function format(date: Date | number, format: string, options?: { locale?: any }): string;
}

declare module 'date-fns/parseISO' {
    export default function parseISO(argument: string, options?: { additionalDigits?: 0 | 1 | 2 }): Date;
}

declare module 'date-fns/locale' {
    export const ru: any;
    export const enUS: any;
} 