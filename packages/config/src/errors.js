export class DevdeckError extends Error {
    code;
    hint;
    constructor(code, message, hint) {
        super(message);
        this.code = code;
        this.hint = hint;
        this.name = "DevdeckError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class ConfigError extends DevdeckError {
    constructor(code, message, hint) {
        super(code, message, hint);
        this.name = "ConfigError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
