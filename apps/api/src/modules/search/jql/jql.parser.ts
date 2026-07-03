import {
  JQLOperator,
  JQLLogicalOperator,
  JQLOrderDirection,
  JQLValue,
  JQLCondition,
  JQLClause,
  JQLOrderBy,
  JQLQuery,
  JQLParseResult,
  JQLFunction,
  JQL_FIELD_MAPPINGS,
} from './jql.types';

interface Token {
  type: 'field' | 'operator' | 'value' | 'logical' | 'orderby' | 'direction' | 'lparen' | 'rparen' | 'comma' | 'function' | 'keyword' | 'eof';
  value: string;
  position: number;
}

const OPERATORS: JQLOperator[] = ['!=', '>=', '<=', '!~', '=', '>', '<', '~', 'IN', 'NOT IN', 'IS NOT', 'IS', 'WAS NOT', 'WAS', 'CHANGED'];
const LOGICAL_OPERATORS: JQLLogicalOperator[] = ['AND', 'OR'];
const _KEYWORDS = ['ORDER', 'BY', 'ASC', 'DESC', 'NOT', 'EMPTY', 'NULL'];

export class JQLParser {
  private input: string = '';
  private position: number = 0;
  private tokens: Token[] = [];
  private tokenIndex: number = 0;

  parse(jql: string): JQLParseResult {
    if (!jql || jql.trim() === '') {
      return { success: true, query: {} };
    }

    this.input = jql;
    this.position = 0;
    this.tokens = [];
    this.tokenIndex = 0;

    try {
      this.tokenize();
      const query = this.parseQuery();
      return { success: true, query };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      return {
        success: false,
        error: message,
        errorPosition: this.position,
      };
    }
  }

  private tokenize(): void {
    while (this.position < this.input.length) {
      this.skipWhitespace();
      if (this.position >= this.input.length) break;

      const char = this.input[this.position];

      if (char === '(') {
        this.tokens.push({ type: 'lparen', value: '(', position: this.position });
        this.position++;
      } else if (char === ')') {
        this.tokens.push({ type: 'rparen', value: ')', position: this.position });
        this.position++;
      } else if (char === ',') {
        this.tokens.push({ type: 'comma', value: ',', position: this.position });
        this.position++;
      } else if (char === '"' || char === "'") {
        this.tokenizeQuotedString(char);
      } else if (this.isOperatorStart()) {
        this.tokenizeOperator();
      } else if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek(1)))) {
        this.tokenizeNumber();
      } else {
        this.tokenizeIdentifierOrKeyword();
      }
    }

    this.tokens.push({ type: 'eof', value: '', position: this.position });
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }
  }

  private peek(offset: number = 0): string {
    return this.input[this.position + offset] || '';
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isOperatorStart(): boolean {
    const remaining = this.input.slice(this.position).toUpperCase();
    return OPERATORS.some(op => remaining.startsWith(op));
  }

  private tokenizeOperator(): void {
    const startPos = this.position;
    const remaining = this.input.slice(this.position).toUpperCase();

    // Try to match longest operator first
    const sortedOps = [...OPERATORS].sort((a, b) => b.length - a.length);
    for (const op of sortedOps) {
      if (remaining.startsWith(op)) {
        // Make sure it's not part of a word (for text operators)
        if (/[A-Z]/.test(op[op.length - 1])) {
          const nextChar = this.input[this.position + op.length];
          if (nextChar && /[A-Za-z0-9_]/.test(nextChar)) {
            continue;
          }
        }
        this.tokens.push({ type: 'operator', value: op, position: startPos });
        this.position += op.length;
        return;
      }
    }

    throw new Error(`Unexpected character at position ${this.position}`);
  }

  private tokenizeQuotedString(quote: string): void {
    const startPos = this.position;
    this.position++; // Skip opening quote
    let value = '';

    while (this.position < this.input.length && this.input[this.position] !== quote) {
      if (this.input[this.position] === '\\' && this.position + 1 < this.input.length) {
        this.position++;
        value += this.input[this.position];
      } else {
        value += this.input[this.position];
      }
      this.position++;
    }

    if (this.position >= this.input.length) {
      throw new Error(`Unterminated string starting at position ${startPos}`);
    }

    this.position++; // Skip closing quote
    this.tokens.push({ type: 'value', value, position: startPos });
  }

  private tokenizeNumber(): void {
    const startPos = this.position;
    let value = '';

    if (this.input[this.position] === '-') {
      value += '-';
      this.position++;
    }

    while (this.position < this.input.length && (this.isDigit(this.input[this.position]) || this.input[this.position] === '.')) {
      value += this.input[this.position];
      this.position++;
    }

    this.tokens.push({ type: 'value', value, position: startPos });
  }

  private tokenizeIdentifierOrKeyword(): void {
    const startPos = this.position;
    let value = '';

    while (this.position < this.input.length && /[A-Za-z0-9_\-.]/.test(this.input[this.position])) {
      value += this.input[this.position];
      this.position++;
    }

    if (value === '') {
      throw new Error(`Unexpected character '${this.input[this.position]}' at position ${this.position}`);
    }

    const upperValue = value.toUpperCase();

    // Check if it's followed by a parenthesis (function call)
    this.skipWhitespace();
    if (this.input[this.position] === '(') {
      this.tokens.push({ type: 'function', value, position: startPos });
      return;
    }

    // Check for keywords
    if (LOGICAL_OPERATORS.includes(upperValue as JQLLogicalOperator)) {
      this.tokens.push({ type: 'logical', value: upperValue, position: startPos });
    } else if (upperValue === 'ORDER') {
      this.tokens.push({ type: 'orderby', value: upperValue, position: startPos });
    } else if (upperValue === 'BY') {
      this.tokens.push({ type: 'keyword', value: upperValue, position: startPos });
    } else if (upperValue === 'ASC' || upperValue === 'DESC') {
      this.tokens.push({ type: 'direction', value: upperValue, position: startPos });
    } else if (upperValue === 'EMPTY' || upperValue === 'NULL') {
      this.tokens.push({ type: 'value', value: null as any, position: startPos });
    } else if (OPERATORS.includes(upperValue as JQLOperator)) {
      this.tokens.push({ type: 'operator', value: upperValue, position: startPos });
    } else {
      // Could be a field name or unquoted value
      this.tokens.push({ type: 'field', value, position: startPos });
    }
  }

  private currentToken(): Token {
    return this.tokens[this.tokenIndex] || { type: 'eof', value: '', position: this.position };
  }

  private consume(expectedType?: string): Token {
    const token = this.currentToken();
    if (expectedType && token.type !== expectedType) {
      throw new Error(`Expected ${expectedType} but got ${token.type} at position ${token.position}`);
    }
    this.tokenIndex++;
    return token;
  }

  private parseQuery(): JQLQuery {
    const query: JQLQuery = {};

    // Parse WHERE clause (conditions)
    if (this.currentToken().type !== 'eof' && this.currentToken().type !== 'orderby') {
      query.where = this.parseOrExpression();
    }

    // Parse ORDER BY clause
    if (this.currentToken().type === 'orderby') {
      this.consume(); // ORDER
      if (this.currentToken().value?.toUpperCase() === 'BY') {
        this.consume(); // BY
      }
      query.orderBy = this.parseOrderBy();
    }

    return query;
  }

  private parseOrExpression(): JQLClause {
    let left = this.parseAndExpression();

    while (this.currentToken().type === 'logical' && this.currentToken().value === 'OR') {
      this.consume(); // OR
      const right = this.parseAndExpression();
      left = {
        type: 'group',
        clauses: [left, right],
        logicalOperator: 'OR',
      };
    }

    return left;
  }

  private parseAndExpression(): JQLClause {
    let left = this.parsePrimaryExpression();

    while (this.currentToken().type === 'logical' && this.currentToken().value === 'AND') {
      this.consume(); // AND
      const right = this.parsePrimaryExpression();
      left = {
        type: 'group',
        clauses: [left, right],
        logicalOperator: 'AND',
      };
    }

    return left;
  }

  private parsePrimaryExpression(): JQLClause {
    // Handle parenthesized expressions
    if (this.currentToken().type === 'lparen') {
      this.consume(); // (
      const expr = this.parseOrExpression();
      this.consume('rparen'); // )
      return expr;
    }

    // Handle NOT
    let negate = false;
    if (this.currentToken().value?.toUpperCase() === 'NOT') {
      this.consume();
      negate = true;
    }

    // Parse condition
    const condition = this.parseCondition();
    condition.negate = negate;

    return {
      type: 'condition',
      condition,
    };
  }

  private parseCondition(): JQLCondition {
    const fieldToken = this.consume('field');
    const field = fieldToken.value.toLowerCase();

    // Validate field
    if (!JQL_FIELD_MAPPINGS[field]) {
      throw new Error(`Unknown field '${fieldToken.value}' at position ${fieldToken.position}`);
    }

    const operatorToken = this.consume('operator');
    const operator = operatorToken.value as JQLOperator;

    const value = this.parseValue(operator);

    return { field, operator, value };
  }

  private parseValue(operator: JQLOperator): JQLValue {
    // Handle IN/NOT IN with list
    if (operator === 'IN' || operator === 'NOT IN') {
      return this.parseValueList();
    }

    // Handle function call
    if (this.currentToken().type === 'function') {
      return this.parseFunction();
    }

    // Handle regular value
    const token = this.currentToken();

    if (token.type === 'value' || token.type === 'field') {
      this.consume();

      // Handle null
      if (token.value === null) {
        return null;
      }

      // Try to parse as number
      const num = Number(token.value);
      if (!isNaN(num) && token.value !== '') {
        return num;
      }

      // Try to parse as boolean
      if (token.value.toLowerCase() === 'true') return true;
      if (token.value.toLowerCase() === 'false') return false;

      return token.value;
    }

    throw new Error(`Expected value at position ${token.position}`);
  }

  private parseValueList(): JQLValue[] {
    const values: JQLValue[] = [];

    this.consume('lparen'); // (

    while (this.currentToken().type !== 'rparen') {
      if (this.currentToken().type === 'function') {
        values.push(this.parseFunction());
      } else {
        const token = this.consume();
        if (token.value !== null) {
          const num = Number(token.value);
          values.push(!isNaN(num) && token.value !== '' ? num : token.value);
        } else {
          values.push(null);
        }
      }

      if (this.currentToken().type === 'comma') {
        this.consume();
      }
    }

    this.consume('rparen'); // )
    return values;
  }

  private parseFunction(): JQLFunction {
    const nameToken = this.consume('function');
    const args: string[] = [];

    this.consume('lparen'); // (

    while (this.currentToken().type !== 'rparen') {
      const argToken = this.consume();
      if (argToken.value !== null && argToken.value !== '') {
        args.push(String(argToken.value));
      }

      if (this.currentToken().type === 'comma') {
        this.consume();
      }
    }

    this.consume('rparen'); // )

    return { name: nameToken.value, args };
  }

  private parseOrderBy(): JQLOrderBy[] {
    const orderBy: JQLOrderBy[] = [];

    do {
      const fieldToken = this.consume('field');
      const field = fieldToken.value.toLowerCase();

      // Validate field
      if (!JQL_FIELD_MAPPINGS[field]) {
        throw new Error(`Unknown field '${fieldToken.value}' at position ${fieldToken.position}`);
      }

      let direction: JQLOrderDirection = 'ASC';
      if (this.currentToken().type === 'direction') {
        direction = this.consume().value as JQLOrderDirection;
      }

      orderBy.push({ field, direction });

      if (this.currentToken().type === 'comma') {
        this.consume();
      } else {
        break;
      }
    } while (this.currentToken().type === 'field');

    return orderBy;
  }
}

// Singleton instance
export const jqlParser = new JQLParser();
