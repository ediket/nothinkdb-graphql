import { expect } from 'chai';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
} from 'graphql';
import{
  globalIdField,
  nodeDefinitions,
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

    it(`should return nodeField, nodeInterface by using tables`, async () => {
      const {} = nodeDefinitionsFromTables([]);

    });

    it(`should return nodeField, nodeInterface by using tables`, async () => {
      const userTable = new Table({
        table: 'user',
        schema: () => ({
          id: Joi.string().meta({ GraphQLType: globalIdField('user')}),
          name: Joi.string(),
        }),
      });

      const { nodeField, nodeInterface } = nodeDefinitionsFromTables({
        user: userTable,
      });
      console.log(getGraphQLFieldsFromTable(userTable).id);
      console.log(globalIdField());

      globalIdField()
      const User = new GraphQLObjectType({
        name: 'user',
        fields: {
          ...getGraphQLFieldsFromTable(userTable),
          id: globalIdField(),
        },
        interfaces: [nodeInterface],
      });

      const Schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            user: {
              type: User,
              resolve: () => ({name: 'nick'}),
            },
          },
        }),
      });

      const query = `
        query {
          user {
            name
          }
        }
      `;

      const result = await graphql(Schema, query);
      console.log(result);
    });
  });
});
