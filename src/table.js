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
} from 'graphql';

export function getGraphQLFieldsFromTable(table) {
  const schema = table.schema();
  return getGraphQLfieldsFromSchema(schema);
}

export function getGraphQLfieldsFromSchema(schema, key) {
  if (_.isObject(schema) && !_.has(schema, 'isJoi')) {
    return _.mapValues(schema, (fieldSchema, fieldKey) => getGraphQLfieldsFromSchema(fieldSchema, fieldKey));
  }

  let GraphQLType;
  const {
    _type: type,
    _description: description,
    _flags: flags,
    _tests: tests,
    _inner: inner,
    _valids: valids,
  } = schema;

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

  if (flags.presence === 'allowOnly') {
    assert.equal(_.isEmpty(valids._set), false, 'enum should have at least 1 item.');
    // TODO: Implement GraphQLEnumType
  }


  if (flags.presence === 'required') {
    GraphQLType = new GraphQLNonNull(GraphQLType);
  }

  return {
    type: GraphQLType,
    description,
  };
}
