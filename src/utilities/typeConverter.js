import { GraphQLScalarType, GraphQLError } from 'graphql';
import { Kind } from 'graphql/language';
import assert from 'assert';
import _ from 'lodash';
import Joi from 'Joi';

export function joiToStringScalaType(name, schema) {
  assert(!_.isEmpty(name), 'required name argument');
  assert(schema.isJoi, 'joi schema required');

  return new GraphQLScalarType({
    name,
    serialize: value => {
      return value;
    },
    parseValue: value => {
      return value;
    },
    parseLiteral: ast => {
      if (ast.kind !== Kind.STRING) {
        throw new GraphQLError('Query error: Can only parse strings got a: ' + ast.kind, [ast]);
      }
      let value;
      try {
        value = Joi.attempt(ast.value, schema);
      } catch (err) {
        throw new GraphQLError(err.message);
      }
      return value;
    },
  });
}
