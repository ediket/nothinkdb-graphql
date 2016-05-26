import { GraphQLSchema } from 'graphql';
import queryType from './types/queryType';

const schema = new GraphQLSchema({
  query: queryType,
});

export default schema;
