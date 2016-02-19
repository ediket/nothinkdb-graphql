import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLScalarType,
  GraphQLError,
} from 'graphql';
import { Kind } from 'graphql/language';
import assert from 'assert';
import _ from 'lodash';
import Joi from 'joi';


function isNotJoiObject(schema) {
  return (_.isObject(schema) && !_.has(schema, 'isJoi'));
}

function mapSchema(schema, iteratee) {
  return _.mapValues(schema, (fieldSchema, fieldKey) => iteratee(fieldSchema, fieldKey));
}

export function joiToGraphQLScalar(name, schema) {
  assert(!_.isEmpty(name), 'required name argument');
  assert(schema.isJoi, 'joi schema r equired');

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

export function joiToBasicScalar(schema) {
  if (isNotJoiObject(schema)) {
    return mapSchema(schema, joiToBasicScalar);
  }
  let GraphQLType;
  const {
    _type: type,
    _description: description,
    _tests: tests,
  } = schema;

  switch (type) {
  case 'boolean':
    GraphQLType = GraphQLBoolean;
    break;
  case 'number':
    GraphQLType = _.find(tests, { name: 'integer' }) ? GraphQLInt : GraphQLFloat;
    break;
  case 'string':
  default:
    GraphQLType = GraphQLString;
    break;
  }

  return {
    type: GraphQLType,
    description,
  };
}

export function joiToGraphQLObjectType(schema, name) {
  if (isNotJoiObject(schema)) {
    return mapSchema(schema, joiToGraphQLObjectType);
  }

  if (!_.isObject(schema) && schema.isJoi) {
    return joiToBasicScalar(schema);
  }

  const {
    _inner: inner,
    _description: description,
  } = schema;

  const GraphQLType = new GraphQLObjectType({
    name,
    fields: _.reduce(inner.children, (memo, child) => {
      return { ...memo, [child.key]: joiToGraphQLObjectType(child.schema, child.key) };
    }, {}),
  });

  return {
    type: GraphQLType,
    description,
  };
}
