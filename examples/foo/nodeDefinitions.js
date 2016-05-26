import r from 'rethinkdb';
import {
  nodeDefinitions,
} from '../../';

export const { nodeField, nodeInterface, registerType } = nodeDefinitions({
  runQuery: async (query) => {
    const connection = await r.connect();
    const result = await query.run(connection);
    connection.close();
    return result;
  },
});
