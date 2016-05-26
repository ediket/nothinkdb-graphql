import { GraphQLObjectType } from 'graphql';
import { nodeField } from '../nodeDefinitions';
import { fooConnectionField } from './fooType';

const queryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    node: nodeField,
    foos: fooConnectionField,
  }),
});

export default queryType;
