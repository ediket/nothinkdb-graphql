import { expect } from 'chai';
import _ from 'lodash';
import {
  graphql,
  GraphQLString,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
import Joi from 'joi';
import {
  joiToStringScalaType,
} from '../typeConverter';

describe('typeConverter', () => {
  describe('joiToStringScalaType', () => {
    it('can convert Joi String type to GraphQLScalarType ', async () => {
      const schema = Joi.string().email();

      const result = joiToStringScalaType('email', schema);
      const expectResult = new GraphQLScalarType({
        name: 'email',
        serialize: () => {},
        parseValue: () => {},
        parseLiteral: () => {},
      });

      expect(result).to.have.all.keys(_.keys(expectResult));
    });

    it('converted GraphQLScalarType can validate query', async () => {
      const EmailType = joiToStringScalaType('email', Joi.string().email());

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
});
