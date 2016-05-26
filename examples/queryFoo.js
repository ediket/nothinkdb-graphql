/* eslint no-console: 0 */
import r from 'rethinkdb';
import { graphql } from 'graphql';
import schema from './foo/schema';
import fooTable from './foo/tables/fooTable';

function print(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

async function run() {
  const connection = await r.connect({});

  await fooTable.sync(connection);
  await fooTable.insert([
    fooTable.create({ bar: 'bar1' }),
    fooTable.create({ bar: 'bar2' }),
  ]).run(connection);

  const query1 = `
    query {
      foos(first: 1) {
        pageInfo {
          hasNextPage
          endCursor
          startCursor
        }
        edges {
          cursor
          node {
            id
            createdAt
            bar
          }
        }
      }
    }
  `;
  const result1 = await graphql(schema, query1);
  print(result1);

  const foo1 = result1.data.foos.edges[0].node;
  const query2 = `
    query {
      node(id: "${foo1.id}") {
        id
        ...on Foo {
          createdAt
          bar
        }
      }
    }
  `;
  const result2 = await graphql(schema, query2);
  print(result2);

  const endCursor = result1.data.foos.pageInfo.endCursor;
  const query3 = `
    query {
      foos(first: 1, after: "${endCursor}") {
        pageInfo {
          hasNextPage
          endCursor
          startCursor
        }
        edges {
          cursor
          node {
            id
            createdAt
            bar
          }
        }
      }
    }
  `;
  const result3 = await graphql(schema, query3);
  print(result3);

  const foo2 = result3.data.foos.edges[0].node;
  const query4 = `
    query {
      node(id: "${foo2.id}") {
        id
        ...on Foo {
          createdAt
          bar
        }
      }
    }
  `;
  const result4 = await graphql(schema, query4);
  print(result4);

  connection.close();
}

run()
  .catch(e => {
    console.log(e);
    process.exit();
  });
