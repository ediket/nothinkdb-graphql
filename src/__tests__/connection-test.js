import { expect } from 'chai';
import _ from 'lodash';
import r from 'rethinkdb';
import { Environment, schema } from 'nothinkdb';
import Joi from 'joi';
import {
  graphql,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
import {
  toGlobalId,
} from 'graphql-relay';
import {
  nodeIdToCursor,
  cursorToNodeId,
  pkToCursor,
  cursorToPk,
  dataToEdge,
  connectionField,
} from '../connection';
import {
  getGraphQLFieldsFromTable,
} from '../field';
import {
  nodeDefinitions,
} from '../node';

const TABLE = 'ConnectionTest';
const TABLE_SIZE = 5000;

describe('connection', () => {
  let table;
  let connection;
  let orderedQuery;
  let environment;

  before(async () => {
    connection = await r.connect({ db: 'test' });
    environment = new Environment({});
    table = environment.createTable({
      tableName: TABLE,
      schema: () => ({
        ...schema,
        nth: Joi.number().meta({ index: true }),
      }),
    });
    await environment.sync(connection);
    await table.query().delete().run(connection);
    await table.insert(
      _.times(TABLE_SIZE, (nth) => ({
        nth,
        id: `${nth}`,
      }))
    ).run(connection);
    orderedQuery = table.query().orderBy({ index: r.asc('nth') });
  });

  after(async () => {
    await r.tableDrop(TABLE).run(connection);
  });

  describe('nodeIdToCursor, cursorToNodeId', () => {
    it('should transform nodeId to cursor, and vice versa', () => {
      const cursor = nodeIdToCursor('example');
      const nodeId = cursorToNodeId(cursor);
      expect(cursor).to.not.equal('example');
      expect(nodeId).to.equal('example');
    });
  });

  describe('pkToCursor & cursorToPk', () => {
    it('should transform pk to cursor, and vice versa', () => {
      const cursor = pkToCursor(TABLE, 'example');
      const resourceId = cursorToPk(cursor);
      expect(cursor).to.not.equal('example');
      expect(resourceId).to.equal('example');
    });
  });

  describe('dataToEdge', () => {
    it('should transform data to edge', async () => {
      const resource = table.query().nth(0).run(connection);
      const edge = dataToEdge(TABLE, resource);

      Joi.assert(edge, {
        cursor: Joi.string().required(),
        node: Joi.object().required(),
      });
    });
  });

  describe('connectionField', () => {
    let Schema;

    before(() => {
      const { nodeInterface, registerType } = nodeDefinitions({
        connect: () => r.connect({}),
      });

      const graphQLType = new GraphQLObjectType({
        name: TABLE,
        fields: getGraphQLFieldsFromTable(table),
        interfaces: [nodeInterface],
      });

      registerType({
        table,
        type: graphQLType,
      });

      const queryType = new GraphQLObjectType({
        name: 'Query',
        fields: () => ({
          connection: connectionField({
            table,
            graphQLType,
            getQuery: (/* root, args, context */) => orderedQuery,
            connect: () => r.connect(),
          }),
        }),
      });

      Schema = new GraphQLSchema({
        query: queryType,
      });
    });

    it('should resolve edges with first & after', async () => {
      const data = await orderedQuery.slice(0, 4).coerceTo('array').run(connection);

      const first = 2;
      const after = pkToCursor(TABLE, data[0].id);

      expect(
        await graphql(Schema, `{
          connection(first: ${first}, after: "${after}") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              endCursor
              startCursor
            }
            edges {
              cursor
              node {
                id
                ...on ${TABLE} {
                  nth
                }
              }
            }
          }
        }`)
      ).to.deep.equal({
        data: {
          connection: {
            pageInfo: {
              hasPreviousPage: false,
              hasNextPage: true,
              startCursor: pkToCursor(TABLE, data[1].id),
              endCursor: pkToCursor(TABLE, data[2].id),
            },
            edges: [{
              cursor: pkToCursor(TABLE, data[1].id),
              node: {
                id: toGlobalId(TABLE, data[1].id),
                nth: data[1].nth,
              },
            }, {
              cursor: pkToCursor(TABLE, data[2].id),
              node: {
                id: toGlobalId(TABLE, data[2].id),
                nth: data[2].nth,
              },
            }],
          },
        },
      });
    });

    it('should resolve edges with last & before', async () => {
      const last = 2;
      const before = pkToCursor(TABLE, `${TABLE_SIZE - 1}`);

      expect(
        await graphql(Schema, `{
          connection(last: ${last}, before: "${before}") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              endCursor
              startCursor
            }
            edges {
              cursor
              node {
                id
                ...on ${TABLE} {
                  nth
                }
              }
            }
          }
        }`)
      ).to.deep.equal({
        data: {
          connection: {
            pageInfo: {
              hasPreviousPage: true,
              hasNextPage: false,
              startCursor: pkToCursor(TABLE, `${TABLE_SIZE - 3}`),
              endCursor: pkToCursor(TABLE, `${TABLE_SIZE - 2}`),
            },
            edges: [{
              cursor: pkToCursor(TABLE, `${TABLE_SIZE - 3}`),
              node: {
                id: toGlobalId(TABLE, `${TABLE_SIZE - 3}`),
                nth: TABLE_SIZE - 3,
              },
            }, {
              cursor: pkToCursor(TABLE, `${TABLE_SIZE - 2}`),
              node: {
                id: toGlobalId(TABLE, `${TABLE_SIZE - 2}`),
                nth: TABLE_SIZE - 2,
              },
            }],
          },
        },
      });
    });

    it('should resolve edges with first & after && last & before', async () => {
      const data = await orderedQuery.slice(0, 5).coerceTo('array').run(connection);

      const last = 2;
      const first = 2;
      const after = pkToCursor(TABLE, data[0].id);
      const before = pkToCursor(TABLE, data[4].id);

      expect(
        await graphql(Schema, `{
          connection(first: ${first}, after: "${after}", last: ${last}, before: "${before}") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              endCursor
              startCursor
            }
            edges {
              cursor
              node {
                id
                ...on ${TABLE} {
                  nth
                }
              }
            }
          }
        }`)
      ).to.deep.equal({
        data: {
          connection: {
            pageInfo: {
              hasPreviousPage: true,
              hasNextPage: true,
              startCursor: pkToCursor(TABLE, data[1].id),
              endCursor: pkToCursor(TABLE, data[2].id),
            },
            edges: [{
              cursor: pkToCursor(TABLE, data[1].id),
              node: {
                id: toGlobalId(TABLE, data[1].id),
                nth: data[1].nth,
              },
            }, {
              cursor: pkToCursor(TABLE, data[2].id),
              node: {
                id: toGlobalId(TABLE, data[2].id),
                nth: data[2].nth,
              },
            }],
          },
        },
      });
    });
  });
});
