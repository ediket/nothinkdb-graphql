import _ from 'lodash';
import assert from 'assert';
import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLList,
  GraphQLEnumType,
} from 'graphql';
import { GraphQLJoiType } from './type';

function isJoiCollection(schema) {
  return _.isObject(schema) && !_.has(schema, 'isJoi');
}

function mapSchema(schema, iteratee) {
  return _.mapValues(schema, (fieldSchema, fieldKey) => iteratee(fieldSchema, fieldKey));
}

export function getGraphQLFieldsFromTable(table) {
  const schema = table.schema();
  return getGraphQLfieldsFromSchema(schema);
}

export function getGraphQLScalarFieldsFromSchema(schema, key) {
  if (isJoiCollection(schema)) {
    return mapSchema(schema, getGraphQLScalarFieldsFromSchema);
  }

  const {
    _description: description,
  } = schema;
  const GraphQLType = new GraphQLJoiType({
    name: key,
    schema,
  });

  return {
    type: GraphQLType,
    description,
  };
}

export function getGraphQLfieldsFromSchema(schema, key) {
  if (isJoiCollection(schema)) {
    return mapSchema(schema, getGraphQLfieldsFromSchema);
  }

  let GraphQLType;
  const {
    _type: type,
    _description: description,
    _flags: flags,
    _tests: tests,
    _inner: inner,
    _valids: valids,
    _meta: meta,
  } = schema;

  if (
    _.chain(meta)
      .find(item => item.isScalar)
      .get('isScalar')
      .value()
    ) {
    return getGraphQLScalarFieldsFromSchema(schema, key);
  }

  switch (type) {
  case 'object':
    GraphQLType = new GraphQLObjectType({
      name: key,
      fields: _.reduce(inner.children, (memo, child) => {
        return { ...memo, [child.key]: getGraphQLfieldsFromSchema(child.schema, child.key) };
      }, {}),
    });
    break;
  case 'array':
    assert.equal(inner.items.length, 1, 'array shoud only have one type');
    const { type: InnerGraphQLType } = getGraphQLfieldsFromSchema(inner.items[0]);
    GraphQLType = new GraphQLList(InnerGraphQLType);
    break;
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

  if (flags.allowOnly) {
    assert.equal(_.isEmpty(valids._set), false, 'enum should have at least 1 item.');
    GraphQLType = new GraphQLEnumType({
      name: key,
      values: _.reduce(valids._set, (result, value) => {
        result[value] = {
          value: value,
        };
        return result;
      }, {}),
    });
  }

  if (flags.presence === 'required') {
    GraphQLType = new GraphQLNonNull(GraphQLType);
  }

  return {
    type: GraphQLType,
    description,
  };
}
