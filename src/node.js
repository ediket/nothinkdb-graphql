import assert from 'assert';
import _ from 'lodash';
import {
  nodeDefinitions as relayNodeDefinitions,
  fromGlobalId,
} from 'graphql-relay';

export function nodeDefinitions({
  connect,
  runQuery = async (query) => {
    assert(_.isFunction(connect), 'connect should be function');
    const connection = await connect();
    const result = await query.run(connection);
    connection.close();
    return result;
  },
}) {
  const resolvers = {};

  function hasType(type) {
    return _.has(resolvers, type);
  }

  function registerType({
    type,
    table,
    assert: assertHook = async (/* id, context, info */) => {},
    afterQuery = async query => query,
  }) {
    if (hasType(type.name)) return;
    resolvers[type.name] = { type, table, assertHook, afterQuery };
  }

  async function resolveObj(globalId, context, info) {
    const { type, id } = fromGlobalId(globalId);

    if (!hasType(type)) return null;

    const { table, assertHook, afterQuery } = resolvers[type];

    await assertHook(id, context, info);

    let query = table.get(id);
    query = await afterQuery(query, context, info);
    const obj = await runQuery(query);

    if (_.isNull(obj)) return null;

    obj._dataType = type;
    return obj;
  }

  function resolveType(obj) {
    if (_.isNull(obj)) return null;
    const { type } = resolvers[obj._dataType];
    return type;
  }

  const {
    nodeInterface,
    nodeField,
  } = relayNodeDefinitions(resolveObj, resolveType);

  return {
    registerType,
    nodeInterface,
    nodeField,
  };
}
