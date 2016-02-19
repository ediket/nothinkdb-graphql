import { expect } from 'chai';
import _ from 'lodash';
import {
  graphql,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
import Joi from 'joi';
import {
  joiToGraphQLScalar,
  joiToBasicScalar,
  joiToGraphQLObjectType,
} from '../typeConverter';

describe('typeConverter', () => {
  describe('joiToGraphQLScalar', () => {
    it('can convert Joi String type to GraphQLScalarType ', async () => {
      const schema = Joi.string().email();

      const result = joiToGraphQLScalar('email', schema);
      const expectResult = new GraphQLScalarType({
        name: 'email',
        serialize: () => {},
        parseValue: () => {},
        parseLiteral: () => {},
      });

      expect(result).to.have.all.keys(_.keys(expectResult));
    });

    it('converted GraphQLScalarType can validate query', async () => {
      const EmailType = joiToGraphQLScalar('email', Joi.string().email());

      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          fields: {
            echo: {
              type: GraphQLString,
              args: {
                email: { type: EmailType },
              },
              resolve: (root, {email}) => {
                return email;
              },
            },
          },
        }),
      });

      let query = `
        query {
          echo (email: "hiexample.com")
        }
      `;

      let result = await graphql(schema, query);
      expect(result.errors).to.have.length(1);


      query = `
        query {
          echo (email: "hie@xample.com")
        }
      `;

      result = await graphql(schema, query);
      expect(result.errors).to.be.empty;
    });
  });

  describe('joiToBasicScalar', () => {
    const schema = {
      string: Joi.string(),
      float: Joi.number(),
      int: Joi.number().integer(),
      boolean: Joi.boolean(),
    };

    const result = joiToBasicScalar(schema);

    expect(result.string.type).to.equal(GraphQLString);
    expect(result.float.type).to.equal(GraphQLFloat);
    expect(result.int.type).to.equal(GraphQLInt);
    expect(result.boolean.type).to.equal(GraphQLBoolean);
  });

  describe('joiToGraphQLObjectType', () => {
    const schema = {
      string: Joi.string(),
      object: Joi.object().keys({
        string: Joi.string(),
      }),
    };

    const result = joiToGraphQLObjectType(schema);
    expect(result.object.type).to.deep.equal(new GraphQLObjectType({
      name: 'object',
      fields: {
        string: result.string,
      },
    }));
  });
});
