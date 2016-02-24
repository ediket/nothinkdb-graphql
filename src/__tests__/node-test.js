import { expect } from 'chai';
import r from 'rethinkdb';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
} from 'graphql';
import{
  globalIdField,
  nodeDefinitions,
  toGlobalId,
} from 'graphql-relay';
import { Table } from 'nothinkdb';
import Joi from 'joi';
import {
  getGraphQLFieldsFromTable,
} from '../table';
import {
  nodeDefinitionsFromTables,
} from '../node';


describe('node', () => {
  let connection;
  before(async () => {
    connection = await r.connect({});
    await r.branch(r.dbList().contains('test').not(), r.dbCreate('test'), null).run(connection);
    r.dbCreate('test');
  });

  beforeEach(async () => {
    await r.branch(r.tableList().contains('user').not(), r.tableCreate('user'), null).run(connection);
  });

  after(async () => {
    await connection.close();
  });

  describe('nodeDefinitionsFromTables', () => {
    it('should return nodeField, nodeInterface property', async () => {
      expect(nodeDefinitionsFromTables([]))
        .to.have.all.keys(['nodeField', 'nodeInterface']);
    });

    it(`nodeField, nodeInterface should be same type in 'graphql-relay' `, async () => {
      const { nodeField, nodeInterface } = nodeDefinitions();
      const nodeFromTable = nodeDefinitionsFromTables();

      expect(nodeFromTable.nodeField.name).to.equal(nodeField.name);
      expect(nodeFromTable.nodeField.description).to.equal(nodeField.description);
      expect(nodeFromTable.nodeField.type.constructor.name)
        .to.equal(nodeField.type.constructor.name);

      expect(nodeFromTable.nodeInterface.name).to.equal(nodeInterface.name);
      expect(nodeFromTable.nodeInterface.description).to.equal(nodeInterface.description);
      expect(nodeFromTable.nodeInterface.constructor.name)
        .to.equal(nodeInterface.constructor.name);
    });

    it(`gets the correct ID for users`, async () => {
      const userTable = new Table({
        table: 'user',
        schema: () => ({
          id: Joi.string().meta({ GraphQLType: globalIdField('user')}),
          name: Joi.string(),
        }),
      });
      await userTable.sync(connection);
      const foo = userTable.create({ id: '122', name: 'nick' });
      await userTable.insert([foo]).run(connection);

      const { nodeField, nodeInterface } = nodeDefinitionsFromTables({
        user: {
          table: userTable,
          getGraphQLType: () => userType,
        },
      });

      const userType = new GraphQLObjectType({
        name: 'User',
        fields: getGraphQLFieldsFromTable(userTable),
        interfaces: [nodeInterface],
      });

      const queryType = new GraphQLObjectType({
        name: 'Query',
        fields: () => ({
          node: nodeField,
        }),
      });
      const Schema = new GraphQLSchema({
        query: queryType,
      });
      const globalId = toGlobalId('user', '122');
      // console.log(globalId);
      const query = `
        query {
          node(id: "${globalId}") {
            id
            __typename
            ... on User {
              id
              name
            }
          }
        }
      `;

      const expected = {
        node: {
          id: globalId,
        },
      };
      // console.log(await graphql(Schema, query));
      // return expect(graphql(Schema, query)).to.become({ data: expected });
    });
  });
});
