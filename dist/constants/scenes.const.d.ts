export declare const SCENES: {
    START: {
        navigateText: string;
        navigateButtons: (import("@telegraf/types").InlineKeyboardButton.CallbackButton & {
            hide: boolean;
        })[][];
    };
    HOME: {
        text: string;
        buttons: ((import("@telegraf/types").InlineKeyboardButton.CallbackButton & {
            hide: boolean;
        })[] | (import("@telegraf/types").InlineKeyboardButton.UrlButton & {
            hide: boolean;
        })[])[];
    };
    START_CONNECT: {
        text: string;
        buttons: ((import("@telegraf/types").InlineKeyboardButton.CallbackButton & {
            hide: boolean;
        })[] | (import("@telegraf/types").InlineKeyboardButton.UrlButton & {
            hide: boolean;
        })[])[];
    };
    TOPUP_BALANCE: {
        text: string;
        buttons: (import("@telegraf/types").InlineKeyboardButton.CallbackButton & {
            hide: boolean;
        })[][];
    };
    GET_CONNECT: (connectionLink: string) => {
        text: string;
    };
    STATUS: {
        text: string;
    };
    QUESTION: {
        text: string;
        buttons: (import("@telegraf/types").InlineKeyboardButton.UrlButton & {
            hide: boolean;
        })[][];
    };
    ERROR: (message: string) => {
        navigateText: string;
        navigateButtons: (import("@telegraf/types").InlineKeyboardButton.CallbackButton & {
            hide: boolean;
        })[];
    };
};
