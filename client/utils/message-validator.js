class MessageValidator {
    constructor(options = {}) {
        this.validationRules = options.rules || {};
        this.responseHandlers = options.handlers || {};
        this.stats = {
            validated: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    // Add validation rule
    addRule(name, validatorFn, options = {}) {
        this.validationRules[name] = {
            validator: validatorFn,
            required: options.required !== false,
            errorMessage: options.errorMessage || `Validation failed for rule: ${name}`
        };
    }

    // Add response handler
    addHandler(type, handlerFn) {
        this.responseHandlers[type] = handlerFn;
    }

    // Validate message against all rules
    validate(message, context = {}) {
        const results = {
            isValid: true,
            errors: [],
            warnings: [],
            context: context
        };

        for (const [ruleName, ruleConfig] of Object.entries(this.validationRules)) {
            try {
                const isValid = ruleConfig.validator(message, context);

                if (!isValid) {
                    results.isValid = false;
                    results.errors.push({
                        rule: ruleName,
                        message: ruleConfig.errorMessage,
                        required: ruleConfig.required
                    });

                    if (ruleConfig.required) {
                        this.stats.failed++;
                        this.stats.errors.push({
                            rule: ruleName,
                            message: ruleConfig.errorMessage,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        results.warnings.push({
                            rule: ruleName,
                            message: ruleConfig.errorMessage
                        });
                    }
                } else {
                    results.isValid = results.isValid && true;
                }
            } catch (error) {
                results.isValid = false;
                results.errors.push({
                    rule: ruleName,
                    message: `Validation rule error: ${error.message}`,
                    required: ruleConfig.required
                });
            }
        }

        this.stats.validated++;
        if (results.isValid) {
            this.stats.passed++;
        }

        return results;
    }

    // Predefined validation rules
    static predefinedRules = {
        // Basic type validations
        isString: (message) => typeof message === 'string',
        isObject: (message) => typeof message === 'object' && message !== null && !Array.isArray(message),
        isArray: (message) => Array.isArray(message),
        isNumber: (message) => typeof message === 'number' && !isNaN(message),
        isBoolean: (message) => typeof message === 'boolean',
        isBuffer: (message) => Buffer.isBuffer(message) || message instanceof ArrayBuffer,

        // JSON validation
        isValidJSON: (message) => {
            if (typeof message !== 'string') return false;
            try {
                JSON.parse(message);
                return true;
            } catch {
                return false;
            }
        },

        // Size validations
        maxSize: (size) => (message) => {
            const messageSize = this.getMessageSize(message);
            return messageSize <= size;
        },

        minSize: (size) => (message) => {
            const messageSize = this.getMessageSize(message);
            return messageSize >= size;
        },

        // Pattern validations
        matchesPattern: (pattern) => (message) => {
            const str = typeof message === 'string' ? message : JSON.stringify(message);
            return new RegExp(pattern).test(str);
        },

        // Schema validation (for JSON objects)
        matchesSchema: (schema) => (message) => {
            if (typeof message !== 'object' || message === null) return false;

            for (const [key, validator] of Object.entries(schema)) {
                if (key.endsWith('?')) {
                    // Optional field
                    const actualKey = key.slice(0, -1);
                    if (actualKey in message && message[actualKey] !== undefined) {
                        if (typeof validator === 'function') {
                            if (!validator(message[actualKey])) return false;
                        } else {
                            if (!MessageValidator.predefinedRules.matchesSchema(validator)(message[actualKey])) return false;
                        }
                    }
                } else {
                    // Required field
                    if (!(key in message)) return false;
                    if (typeof validator === 'function') {
                        if (!validator(message[key])) return false;
                    } else {
                        if (!MessageValidator.predefinedRules.matchesSchema(validator)(message[key])) return false;
                    }
                }
            }
            return true;
        },

        // Custom validators
        custom: (validatorFn) => validatorFn
    };

    // Get message size in bytes
    static getMessageSize(message) {
        if (typeof message === 'string') {
            return Buffer.byteLength(message, 'utf8');
        } else if (Buffer.isBuffer(message)) {
            return message.length;
        } else if (message instanceof ArrayBuffer) {
            return message.byteLength;
        } else {
            return Buffer.byteLength(JSON.stringify(message), 'utf8');
        }
    }

    // Response handling
    async handleResponse(message, responseType = 'default') {
        const handler = this.responseHandlers[responseType] || this.responseHandlers.default;

        if (handler) {
            try {
                return await handler(message);
            } catch (error) {
                console.error(`[RESPONSE] Handler error for ${responseType}:`, error.message);
                throw error;
            }
        } else {
            // Default response handling
            return this.defaultResponseHandler(message);
        }
    }

    defaultResponseHandler(message) {
        // Try to parse as JSON if it's a string
        if (typeof message === 'string') {
            try {
                const parsed = JSON.parse(message);
                return {
                    type: 'parsed_json',
                    data: parsed,
                    raw: message
                };
            } catch {
                return {
                    type: 'raw_string',
                    data: message
                };
            }
        }

        // Handle binary data
        if (Buffer.isBuffer(message) || message instanceof ArrayBuffer) {
            return {
                type: 'binary_data',
                data: message,
                size: MessageValidator.getMessageSize(message)
            };
        }

        return {
            type: 'unknown',
            data: message
        };
    }

    // Message transformation utilities
    transformMessage(message, transformations) {
        let result = message;

        for (const transform of transformations) {
            if (typeof transform === 'function') {
                result = transform(result);
            } else if (typeof transform === 'object' && transform.fn) {
                result = transform.fn(result, transform.options);
            }
        }

        return result;
    }

    // Validation middleware
    useValidationMiddleware(middleware) {
        this.middleware = middleware;
    }

    async validateWithMiddleware(message, context = {}) {
        if (this.middleware) {
            try {
                const processedMessage = await this.middleware(message, context);
                return this.validate(processedMessage, context);
            } catch (error) {
                return {
                    isValid: false,
                    errors: [{ rule: 'middleware', message: error.message, required: true }],
                    warnings: [],
                    context: context
                };
            }
        }
        return this.validate(message, context);
    }

    // Statistics
    getStats() {
        return { ...this.stats };
    }

    resetStats() {
        this.stats = {
            validated: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    // Common validation presets
    static createJSONValidator(schema, options = {}) {
        const validator = new MessageValidator();

        validator.addRule('isString', MessageValidator.predefinedRules.isString, { required: true });
        validator.addRule('isValidJSON', MessageValidator.predefinedRules.isValidJSON, { required: true });

        if (schema) {
            validator.addRule('matchesSchema', MessageValidator.predefinedRules.matchesSchema(schema), {
                required: true,
                errorMessage: 'Message does not match expected schema'
            });
        }

        if (options.maxSize) {
            validator.addRule('maxSize', MessageValidator.predefinedRules.maxSize(options.maxSize), {
                required: true,
                errorMessage: `Message exceeds maximum size of ${options.maxSize} bytes`
            });
        }

        return validator;
    }

    static createTextValidator(options = {}) {
        const validator = new MessageValidator();

        validator.addRule('isString', MessageValidator.predefinedRules.isString, { required: true });

        if (options.minLength) {
            validator.addRule('minLength', MessageValidator.predefinedRules.minSize(options.minLength), {
                required: true,
                errorMessage: `Message is shorter than minimum length of ${options.minLength}`
            });
        }

        if (options.maxLength) {
            validator.addRule('maxLength', MessageValidator.predefinedRules.maxSize(options.maxLength), {
                required: true,
                errorMessage: `Message exceeds maximum length of ${options.maxLength}`
            });
        }

        if (options.pattern) {
            validator.addRule('matchesPattern', MessageValidator.predefinedRules.matchesPattern(options.pattern), {
                required: true,
                errorMessage: 'Message does not match expected pattern'
            });
        }

        return validator;
    }

    static createBinaryValidator(options = {}) {
        const validator = new MessageValidator();

        validator.addRule('isBuffer', MessageValidator.predefinedRules.isBuffer, { required: true });

        if (options.minSize) {
            validator.addRule('minSize', MessageValidator.predefinedRules.minSize(options.minSize), {
                required: true,
                errorMessage: `Binary data is smaller than minimum size of ${options.minSize} bytes`
            });
        }

        if (options.maxSize) {
            validator.addRule('maxSize', MessageValidator.predefinedRules.maxSize(options.maxSize), {
                required: true,
                errorMessage: `Binary data exceeds maximum size of ${options.maxSize} bytes`
            });
        }

        return validator;
    }

    // Validation chain builder
    static buildValidationChain() {
        return new ValidationChain();
    }
}

class ValidationChain {
    constructor() {
        this.validators = [];
        this.conditions = [];
    }

    addValidator(validator, condition = null) {
        this.validators.push(validator);
        this.conditions.push(condition);
        return this;
    }

    async validate(message, context = {}) {
        for (let i = 0; i < this.validators.length; i++) {
            const validator = this.validators[i];
            const condition = this.conditions[i];

            // Skip validation if condition is not met
            if (condition && !condition(message, context)) {
                continue;
            }

            const result = await validator.validateWithMiddleware(message, context);

            if (!result.isValid) {
                return result;
            }
        }

        return { isValid: true, errors: [], warnings: [], context };
    }
}

// Export both classes
module.exports = { MessageValidator, ValidationChain };

// Example usage
if (require.main === module) {
    // Example 1: JSON validation
    const jsonValidator = MessageValidator.createJSONValidator({
        id: MessageValidator.predefinedRules.isNumber,
        name: MessageValidator.predefinedRules.isString,
        data: { value: MessageValidator.predefinedRules.isNumber }
    }, { maxSize: 1024 });

    console.log('JSON validation:', jsonValidator.validate('{"id": 1, "name": "test", "data": {"value": 123}}'));

    // Example 2: Text validation
    const textValidator = MessageValidator.createTextValidator({
        minLength: 5,
        maxLength: 100,
        pattern: '^[a-zA-Z0-9\\s]+$'
    });

    console.log('Text validation:', textValidator.validate('Hello World'));

    // Example 3: Custom validation chain
    const chain = MessageValidator.buildValidationChain()
        .addValidator(jsonValidator)
        .addValidator(MessageValidator.createTextValidator({ maxLength: 50 }),
            (msg) => typeof msg === 'string');

    console.log('Chain validation:', chain.validate('{"id": 1}'));

    // Print statistics
    console.log('JSON Validator Stats:', jsonValidator.getStats());
    console.log('Text Validator Stats:', textValidator.getStats());
}