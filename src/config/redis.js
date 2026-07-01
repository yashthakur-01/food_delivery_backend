const redisClient = {
  incr: async () => 1,
  expire: async () => true,
  get: async () => null,
  set: async () => "OK",
  del: async () => 1,
  ping: async () => "PONG",
};

module.exports = redisClient;