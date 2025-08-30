import { describe, it, expect } from "vitest";

import type { ImportMetaMatch } from "../src";
import {
  findDynamicImports,
  findStaticImports,
  findImportMeta,
  parseStaticImport,
  findTypeImports,
  parseTypeImport,
} from "../src";

// -- Static import --

type MaybeArray<T> = T | T[];
const staticTests: Record<
  string,
  MaybeArray<{
    specifier: string;
    defaultImport?: string;
    namespacedImport?: string;
    namedImports?: Record<string, string>;
    type?: string;
  }>
> = {
  'import defaultMember from "module-name";': {
    specifier: "module-name",
    defaultImport: "defaultMember",
  },
  'import *    as name from "module-name  ";': {
    specifier: "module-name",
    namespacedImport: "name",
  },
  'import *    as name from "module-name  "; //test': {
    specifier: "module-name",
    namespacedImport: "name",
  },
  'import { member } from "  module-name";': {
    specifier: "module-name",
    namedImports: { member: "member" },
  },
  'import { member as alias } from "module-name";': {
    specifier: "module-name",
    namedImports: { member: "alias" },
  },
  'import { member1, member2 as alias2, member3 as alias3 } from "module-name";':
    {
      specifier: "module-name",
      namedImports: {
        member1: "member1",
        member2: "alias2",
        member3: "alias3",
      },
    },
  'import { memberFormattedWithPrettier, } from "module-name";': {
    specifier: "module-name",
    namedImports: {
      memberFormattedWithPrettier: "memberFormattedWithPrettier",
    },
  },
  'import { member1, /* member0point5, */ member2 as alias2, member3 as alias3 } from "module-name";':
    {
      specifier: "module-name",
      namedImports: {
        member1: "member1",
        member2: "alias2",
        member3: "alias3",
      },
    },
  'import defaultMember, { member, /* test */ member } from "module-name";': {
    specifier: "module-name",
    defaultImport: "defaultMember",
    namedImports: { member: "member" },
  },
  'import defaultMember, * as name from "module-name";': {
    specifier: "module-name",
    defaultImport: "defaultMember",
    namespacedImport: "name",
  },
  'import "module-name";': {
    specifier: "module-name",
  },
  'import { thing } from "module-name";import { other } from "other-module"': [
    {
      specifier: "module-name",
      namedImports: { thing: "thing" },
    },
    {
      specifier: "other-module",
      namedImports: { other: "other" },
    },
  ],
  // Edge cases
  '"import"===node.object.meta.name&&"': [],
  'import { SpecialÜ } from "#components"': [
    {
      namedImports: { SpecialÜ: "SpecialÜ" },
      specifier: "#components",
    },
  ],
  'import type { foo } from "bar"': [
    {
      type: "static",
      defaultImport: "type",
      namedImports: { foo: "foo" },
      specifier: "bar",
    },
  ],
  "function a(){}import baz, { x, y as z } from 'baz'": [
    {
      defaultImport: "baz",
      namedImports: { x: "x", y: "z" },
      specifier: "baz",
    },
  ],
};

staticTests[
  `
Object.freeze(['node', 'import'])
const a = 123

const b = new Set(['node', 'import'])
const c = ['.mjs', '.cjs', '.js', '.json']
`
] = [];

staticTests[
  `import {
  member1,
  // @hello.123
  member2
} from "module-name";`
] = {
  specifier: "module-name",
  namedImports: { member1: "member1", member2: "member2" },
};

staticTests[
  `import {
  member1,

  member2
} from "module-name";`
] = {
  specifier: "module-name",
  namedImports: { member1: "member1", member2: "member2" },
};

staticTests[
  `import {
  Component
} from '@angular2/core';`
] = {
  specifier: "@angular2/core",
  type: "static",
  namedImports: { Component: "Component" },
};

staticTests['import { foo, type Foo } from "foo"'] = {
  specifier: "foo",
  namedImports: { foo: "foo" },
};

staticTests[
  `
  // import { foo } from "foo"
  import { too } from "too"

  /**
   * import { zoo } from "zoo"
   */

  const start = '/*'
  import { ioo } from "ioo"
  const end = '*/'
`
] = [
  {
    specifier: "too",
    type: "static",
    namedImports: { too: "too" },
  },
  {
    specifier: "ioo",
    type: "static",
    namedImports: { ioo: "ioo" },
  },
];

// -- Dynamic import --
const dynamicTests = {
  'const { test, /* here */, another, } = await import ( "module-name" );': {
    expression: '"module-name"',
  },
  'var promise = import ( "module-name" );': {
    expression: '"module-name"',
  },
  'import ( "module-name" );': {
    expression: '"module-name"',
  },
  'import(foo("123"))': {
    expression: 'foo("123")',
  },
  'import("abc").then(r => r.default)': {
    expression: '"abc"',
  },
  '// import("abc").then(r => r.default)': [],
  '/* import("abc").then(r => r.default) */': [],
} as const;

const TypeTests = {
  'import { type Foo, Bar } from "module-name";': {
    specifier: "module-name",
    namedImports: {
      Foo: "Foo",
    },
    type: "static",
  },
  'import { member,/* hello */  type Foo as Baz, Bar } from "module-name";': {
    specifier: "module-name",
    namedImports: {
      Foo: "Baz",
    },
    type: "static",
  },
  'import type { Foo, Bar } from "module-name";': {
    specifier: "module-name",
    namedImports: {
      Foo: "Foo",
      Bar: "Bar",
    },
    type: "type",
  },
  'import type Foo from "module-name";': {
    specifier: "module-name",
    defaultImport: "Foo",
    type: "type",
  },
  'import type { Foo as Baz, Bar } from "module-name";': {
    specifier: "module-name",
    namedImports: {
      Foo: "Baz",
      Bar: "Bar",
    },
    type: "type",
  },
  'import { type member } from "  module-name";': {
    specifier: "module-name",
    namedImports: { member: "member" },
    type: "static",
  },
  'import { type member, type Foo as Bar } from "  module-name";': {
    specifier: "module-name",
    namedImports: {
      member: "member",
      Foo: "Bar",
    },
    type: "static",
  },
};

const importMetaTests: Record<string, ImportMetaMatch[]> = {
  // 1 depth property access
  "import.meta.url": [
    {
      type: "meta",
      code: "import.meta.url",
      start: 0,
      end: 15,
      chain: [{ name: "url", type: "property" }],
    },
  ],
  "import.meta.env": [
    {
      type: "meta",
      code: "import.meta.env",
      start: 0,
      end: 15,
      chain: [{ name: "env", type: "property" }],
    },
  ],

  // 2+ depth property access
  "import.meta.env.NODE_ENV": [
    {
      type: "meta",
      code: "import.meta.env.NODE_ENV",
      start: 0,
      end: 24,
      chain: [
        { name: "env", type: "property" },
        { name: "NODE_ENV", type: "property" },
      ],
    },
  ],
  "const version = import.meta.env.VITE_VERSION || 'dev'": [
    {
      type: "meta",
      code: "import.meta.env.VITE_VERSION",
      start: 16,
      end: 44,
      chain: [
        { name: "env", type: "property" },
        { name: "VITE_VERSION", type: "property" },
      ],
    },
  ],

  // 1 depth method call
  "import.meta.resolve()": [
    {
      type: "meta",
      code: "import.meta.resolve()",
      start: 0,
      end: 21,
      chain: [{ name: "resolve", type: "call", args: [] }],
    },
  ],
  "import.meta.resolve('./module')": [
    {
      type: "meta",
      code: "import.meta.resolve('./module')",
      start: 0,
      end: 31,
      chain: [{ name: "resolve", type: "call", args: ["'./module'"] }],
    },
  ],
  'import.meta.resolve("./module")': [
    {
      type: "meta",
      code: 'import.meta.resolve("./module")',
      start: 0,
      end: 31,
      chain: [{ name: "resolve", type: "call", args: ['"./module"'] }],
    },
  ],

  // 2+ depth method call
  "import.meta.foo.method()": [
    {
      type: "meta",
      code: "import.meta.foo.method()",
      start: 0,
      end: 24,
      chain: [
        { name: "foo", type: "property" },
        { name: "method", type: "call", args: [] },
      ],
    },
  ],
  "import.meta.env.getValue('key')": [
    {
      type: "meta",
      code: "import.meta.env.getValue('key')",
      start: 0,
      end: 31,
      chain: [
        { name: "env", type: "property" },
        { name: "getValue", type: "call", args: ["'key'"] },
      ],
    },
  ],

  // multiple statements
  "const url = import.meta.url; import.meta.resolve(url)": [
    {
      type: "meta",
      code: "import.meta.url",
      start: 12,
      end: 27,
      chain: [{ name: "url", type: "property" }],
    },
    {
      type: "meta",
      code: "import.meta.resolve(url)",
      start: 29,
      end: 53,
      chain: [{ name: "resolve", type: "call", args: ["url"] }],
    },
  ],

  // chain calls
  "import.meta.resolve('./mod').then(console.log)": [
    {
      type: "meta",
      code: "import.meta.resolve('./mod').then(console.log)",
      start: 0,
      end: 46,
      chain: [
        { name: "resolve", type: "call", args: ["'./mod'"] },
        { name: "then", type: "call", args: ["console.log"] },
      ],
    },
  ],

  // negative cases
  "// import.meta": [],
  "/* import.meta */": [],
  '"import.meta.url"': [],
  // Block comments between tokens
  "import.meta/* comment */.url": [
    {
      type: "meta",
      code: "import.meta/* comment */.url",
      start: 0,
      end: 28,
      chain: [{ name: "url", type: "property" }],
    },
  ],
  "import.meta./* comment */env.NODE_ENV": [
    {
      type: "meta",
      code: "import.meta./* comment */env.NODE_ENV",
      start: 0,
      end: 37,
      chain: [
        { name: "env", type: "property" },
        { name: "NODE_ENV", type: "property" },
      ],
    },
  ],
  // $ in identifier names
  "import.meta.$store": [
    {
      type: "meta",
      code: "import.meta.$store",
      start: 0,
      end: 18,
      chain: [{ name: "$store", type: "property" }],
    },
  ],
  "import.meta.env.$NODE_ENV": [
    {
      type: "meta",
      code: "import.meta.env.$NODE_ENV",
      start: 0,
      end: 25,
      chain: [
        { name: "env", type: "property" },
        { name: "$NODE_ENV", type: "property" },
      ],
    },
  ],
};

// multiline chain
importMetaTests[
  `import.meta
    .env
    .NODE_ENV`
] = [
  {
    type: "meta",
    code: `import.meta
    .env
    .NODE_ENV`,
    start: 0,
    end: 34,
    chain: [
      { name: "env", type: "property" },
      { name: "NODE_ENV", type: "property" },
    ],
  },
];
importMetaTests[
  `import.meta
    .resolve()
    .then(console.log)`
] = [
  {
    type: "meta",
    code: `import.meta
    .resolve()
    .then(console.log)`,
    start: 0,
    end: 49,
    chain: [
      { name: "resolve", type: "call", args: [] },
      { name: "then", type: "call", args: ["console.log"] },
    ],
  },
];

// multiline args
importMetaTests[
  `import.meta.resolve(
  './module',
  { conditions: ['import'] }
)`
] = [
  {
    type: "meta",
    code: `import.meta.resolve(
  './module',
  { conditions: ['import'] }
)`,
    start: 0,
    end: 65,
    chain: [
      {
        name: "resolve",
        type: "call",
        args: ["'./module'", "{ conditions: ['import'] }"],
      },
    ],
  },
];

describe("findStaticImports", () => {
  for (const [input, _results] of Object.entries(staticTests)) {
    it(input.replace(/\n/g, String.raw`\n`), () => {
      const matches = findStaticImports(input);
      const expected = Array.isArray(_results) ? _results : [_results];
      expect(matches.length).toEqual(expected.length);
      for (const [index, test] of expected.entries()) {
        const match = matches[index];
        expect(match.type).to.equal("static");

        expect(match.specifier).to.equal(test.specifier);

        const parsed = parseStaticImport(match);
        if (test.defaultImport) {
          expect(parsed.defaultImport).to.equals(test.defaultImport);
        }
        if (test.namedImports) {
          expect(parsed.namedImports).to.eql(test.namedImports);
        }
        if (test.namespacedImport) {
          expect(parsed.namespacedImport).to.eql(test.namespacedImport);
        }
      }
    });
  }
});

describe("findDynamicImports", () => {
  for (const [input, test] of Object.entries(dynamicTests)) {
    it(input.replace(/\n/g, String.raw`\n`), () => {
      const matches = findDynamicImports(input);
      expect(matches.length).to.equal(Array.isArray(test) ? test.length : 1);
      const match = matches[0];
      if (match) {
        expect(match.type).to.equal("dynamic");
        expect(match.expression.trim()).to.equal((test as any).expression);
      }
    });
  }
});

describe("findTypeImports", () => {
  for (const [input, _results] of Object.entries(TypeTests)) {
    it(input.replace(/\n/g, String.raw`\n`), () => {
      const matches = findTypeImports(input);
      const results = Array.isArray(_results) ? _results : [_results];
      expect(matches.length).toEqual(results.length);
      for (const [index, test] of results.entries()) {
        const match = matches[index];
        expect(match.specifier).to.equal(test.specifier);

        const parsed = parseTypeImport(match);
        if (test.type) {
          expect(parsed.type).to.equals(test.type);
        }
        if (test.defaultImport) {
          expect(parsed.defaultImport).to.equals(test.defaultImport);
        }
        if (test.namedImports) {
          expect(parsed.namedImports).to.eql(test.namedImports);
        }
        if (test.namespacedImport) {
          expect(parsed.namespacedImport).to.eql(test.namespacedImport);
        }
      }
    });
  }
});

describe("findImportMeta", () => {
  for (const [input, expected] of Object.entries(importMetaTests)) {
    it(input.replace(/\n/g, String.raw`\n`), () => {
      const matches = findImportMeta(input);
      expect(matches.length).toEqual(expected.length);
      for (const [index, test] of expected.entries()) {
        const match = matches[index];
        expect(match.type).to.equal("meta");
        expect(match.code).to.equal(test.code);
        expect(match.start).to.equal(test.start);
        expect(match.end).to.equal(test.end);
        expect(match.chain).to.eql(test.chain);
      }
    });
  }
});
