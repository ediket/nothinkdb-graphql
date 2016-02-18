import { expect } from 'chai';
import {
  graphql,
  GraphQLSchema,
  GraphQLString,
  GraphQLObjectType,
} from 'graphql';
import {
  getFieldsFromContext,
  getRelationsFromFields,
} from '../context';

describe('context', () => {
  describe('getFieldsFromContext', () => {
    it('should get fields from context', async () => {
      let fields;

      const Bar = new GraphQLObjectType({
        name: 'Bar',
        fields: {
          baz: {
            type: GraphQLString,
          },
        },
      });

      const Foo = new GraphQLObjectType({
        name: 'Foo',
        fields: {
          bar: {
            type: Bar,
          },
        },
      });

      const Query = new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: {
            type: Foo,
            resolve: (root, args, context) => {
              fields = getFieldsFromContext(context);
            },
          },
        },
      });

      const Schema = new GraphQLSchema({
        query: Query,
      });

      await graphql(Schema, `
        query {
          foo {
            bar {
              baz
            }
          }
        }
      `);

      expect(fields).to.deep.equal({
        bar: {
          baz: true,
        },
      });
    });
  });

  describe('getRelationsFromFields', () => {
    it('should get relations from fields', async () => {
      let relations;

      const Bar = new GraphQLObjectType({
        name: 'Bar',
        fields: {
          baz: {
            type: GraphQLString,
          },
        },
      });

      const Foo = new GraphQLObjectType({
        name: 'Foo',
        fields: {
          bar: {
            type: Bar,
          },
        },
      });

      const Query = new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: {
            type: Foo,
            resolve: (root, args, context) => {
              relations = getRelationsFromFields(
                getFieldsFromContext(context)
              );
            },
          },
        },
      });

      const Schema = new GraphQLSchema({
        query: Query,
      });

      await graphql(Schema, `
        query {
          foo {
            bar {
              baz
            }
          }
        }
      `);

      expect(relations).to.deep.equal({
        bar: true,
      });
    });
  });
});
