// Mock console.error for testing
global.console.error = jest.fn();

// Mock chrome API
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    group: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
    },
    onRemoved: {
      addListener: jest.fn(),
    },
  },
  tabGroups: {
    update: jest.fn(),
  },
  alarms: {
    clear: jest.fn(),
    create: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    getURL: jest.fn(),
  },
};

// Mock settings
global.settings = {
  similarityThreshold: 0.3,
  groupingInterval: 5,
  maxGroupNameLength: 15,
  groupingAlgorithm: 'tfidf',
  bm25k1: 1.5,
  bm25b: 0.75,
  lsaDimensions: 50,
}; 