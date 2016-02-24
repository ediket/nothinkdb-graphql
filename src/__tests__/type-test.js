import { expect } from 'chai';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import Joi from 'joi';
import {
  GraphQLJoiType,
} from '../type';

describe('type', () => {
  describe('GraphQLJoiType', () => {
    it('should create graphql type with joi schema', async () => {
      const GraphQLEmailType = new GraphQLJoiType({
        name: 'Email',
        schema: Joi.string().email(),
      });

      expect(GraphQLEmailType).have.property('name', 'Email');
      expect(GraphQLEmailType).have.property('schema');

      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          fields: {
            echo: {
              type: GraphQLString,
              args: {
                email: { type: GraphQLEmailType },
              },
              resolve: (root, { email }) => email,
            },
          },
        }),
      });

      let result = await graphql(schema, `
        query {
          echo (email: "hiexample.com")
        }
      `);
      expect(result.errors).to.have.length(1);

      result = await graphql(schema, `
        query {
          echo (email: "hie@xample.com")
        }
      `);
      expect(result.errors).to.be.empty;
    });
  });
});
