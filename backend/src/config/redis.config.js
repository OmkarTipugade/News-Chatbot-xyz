const { createClient } = require('redis');

const initializeRedisClient = async () => {
    const client = createClient({
        username: 'default',
        password: '0dJvsnJyv66XMutnwwcMHtwPFGpFVJYm',
        socket: {
            host: 'redis-17640.crce206.ap-south-1-1.ec2.redns.redis-cloud.com',
            port: 17640
        }
    });
    
    client.on('error', err => console.log('Redis Client Error', err));
    
    await client.connect();
    
    await client.set('foo', 'bar');
    const result = await client.get('foo');
    console.log(result)  

}

initializeRedisClient();
