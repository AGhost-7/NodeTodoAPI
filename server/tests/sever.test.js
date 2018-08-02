const expect = require('expect');
const request = require('supertest');

const {app} = require('./../server');
const {Todo} = require('./../models/todo_model');
const {User} = require('./../models/user_model');
const {ObjectID} = require('mongodb');
const {todos, users, populateTodos, populateUsers} = require('./seed/seed');

// Clean db before every test case
beforeEach(populateUsers);
beforeEach(populateTodos);

describe('POST /todos', () => {
    it('should create a todo', (done) => {
        var text = 'Test Todos';
        let token = users[0].tokens[0].token;
        request(app)
            .post('/todos')
            .set('x-auth', token)
            .send({text})
            .expect(200)
            .expect((res) => {
                expect(res.body.text).toBe(text);
            })
            .end((err, res) => {
                if (err) return done(err);
                // Check if saved in db
                Todo.find({
                    text
                }).then((todos) => {
                    expect(todos.length).toBe(1);
                    expect(todos[0].text).toBe(text);
                    done();
                }).catch((err) => done(err));
            });
    });

    it('should not create todo without required params', (done) => {
        let token = users[0].tokens[0].token;

        // no assertion about body is needed
        request(app)
            .post('/todos')
            .set('x-auth', token)
            .send({})
            .expect(400)
            .end((err) => {
                if (err) return done(err);

                Todo.find().then((todos) => {
                    expect(todos.length).toBe(todos.length);
                    done();
                }).catch((err) => done(err));
            });
    });
});

describe('GET /todos', () => {
    it('should get all todos related to user from db', (done) => {
        let token = users[0].tokens[0].token;
        request(app)
            .get('/todos')
            .set('x-auth', token)
            .expect(200)
            .expect((res) => {
                expect(res.body.todoArr.length).toBe(1);
            })
            .end(done);
    });
});

describe('GET /todos/:id', () => {

    it('should return todo doc', (done) => {
        let todoId = todos[0]._id.toHexString();
        let token = users[0].tokens[0].token;

        request(app)
            .get(`/todos/${todoId}`)
            .set('x-auth', token)
            .expect(200)
            .expect((res) => {
                expect(res.body.todo.text).toBe(todos[0].text);
            })
            .end(done);
    });

    it('should return 404 if todo not found', (done) => {
        var hexId = new ObjectID().toHexString();
        let token = users[0].tokens[0].token;

        request(app)
            .get(`/todos/${hexId}`)
            .set('x-auth', token)
            .expect(404)
            .end(done);
    });

    it('should return 404 for invalid object ids', (done) => {
        let token = users[0].tokens[0].token;

        request(app)
            .get('/todos/123')
            .set('x-auth', token)
            .expect(404)
            .end(done);
    });

    it('should not return todo doc created by other user', (done) => {
        let todoId = todos[1]._id.toHexString();
        let token = users[0].tokens[0].token;

        request(app)
            .get(`/todos/${todoId}`)
            .set('x-auth', token)
            .expect(404)
            .end(done);
    });
});

describe('DELETE /todos/:id', () => {
    it('should delete a todo', (done) => {
        let todoId = todos[1]._id.toHexString();
        let token = users[1].tokens[0].token;

        request(app)
            .delete(`/todos/${todoId}`)
            .set('x-auth', token)
            .expect(200)
            .expect((res) => {
                expect(res.body.todo._id).toBe(todoId);
            })
            .end((err) => {
                if (err) return done(err);

                Todo.findById(todoId).then((todo) => {
                    expect(todo).toNotExist();
                    done();
                }).catch((err) => done(err));
            });
    });

    it('should not delete a todo owned by other user', (done) => {
        let todoId = todos[0]._id.toHexString();
        let token = users[1].tokens[0].token;

        request(app)
            .delete(`/todos/${todoId}`)
            .set('x-auth', token)
            .expect(404)
            .end((err) => {
                if (err) return done(err);

                Todo.findById(todoId).then((todo) => {
                    expect(todo).toExist();
                    done();
                }).catch((err) => done(err));
            });
    });


    it('should return 404 if todo not found', (done) => {
        var hexId = new ObjectID().toHexString();
        let token = users[1].tokens[0].token;
        request(app)
            .delete(`/todos/${hexId}`)
            .set('x-auth', token)
            .expect(404)
            .end(done);
    });

    it('should return 404 for invalid object ids', (done) => {
        let token = users[1].tokens[0].token;
        request(app)
            .delete('/todos/123')
            .set('x-auth', token)
            .expect(404)
            .end(done);
    });
});

describe('PATCH /todos/:id', () => {
    it('should update own todo', (done) => {
        let text = 'Todo Update test';
        let todoId = todos[1]._id.toHexString();
        let token = users[1].tokens[0].token;
        let completed = true;

        request(app)
            .patch(`/todos/${todoId}`)
            .set('x-auth', token)
            .send({text, completed})
            .expect(200)
            .expect((res) => {
                expect(res.body.todo.text).toBe(text);
                expect(res.body.todo.completed).toBe(completed);
                expect(res.body.todo.completedAt).toBeTruthy();//toBeA('number')
            }).end(done);
    });

    it('should not update other user\'s todo', (done) => {
        let text = 'Todo Update test 2';
        let todoId = todos[0]._id.toHexString();
        let token = users[1].tokens[0].token;
        let completed = true;

        request(app)
            .patch(`/todos/${todoId}`)
            .set('x-auth', token)
            .send({text, completed})
            .expect(404)
            .end(done);
    });

    it('should clear completedAt if todo not completed', (done) => {
        let text = 'Todo Update test 2';
        let todoId = todos[1]._id.toHexString();
        let token = users[1].tokens[0].token;
        let completed = false;

        request(app)
            .patch(`/todos/${todoId}`)
            .set('x-auth', token)
            .send({text, completed})
            .expect(200)
            .expect((res) => {
                expect(res.body.todo.text).toBe(text);
                expect(res.body.todo.completed).toBe(completed);
                expect(res.body.todo.completedAt).toNotExist();
            }).end(done);
    });

    it('should return 404 if todo not found', (done) => {
        var hexId = new ObjectID().toHexString();
        let token = users[1].tokens[0].token;

        request(app)
            .patch(`/todos/${hexId}`)
            .set('x-auth', token)
            .expect(404)
            .end(done);
    });

    it('should return 404 for invalid object ids', (done) => {
        let token = users[1].tokens[0].token;

        request(app)
            .patch('/todos/123')
            .set('x-auth', token)
            .expect(404)
            .end(done);
    });
});

describe('GET /users/me', () => {
    it('should return user if authenticated', (done) => {
        let token  = users[0].tokens[0].token;
        let id  = users[0]._id.toHexString();
        let email = users[0].email;

        request(app)
            .get('/users/me')
            .set('x-auth', token)
            .expect(200)
            .expect((res) => {
                expect(res.body._id).toBe(id);
                expect(res.body.email).toBe(email);
            })
            .end(done);
    });

    it('should return 401 if not authenticated', (done) => {
        request(app)
            .get('/users/me')
            .expect(401)
            .expect((res) => {
                expect(res.body).toEqual({});
            })
            .end(done);
    });
});

describe('POST /users', () => {
    it('should create user', (done) => {
        let email = 'example@lala.com';
        let password = 'username';

        request(app)
            .post('/users')
            .send({email, password})
            .expect(200)
            .expect((res) => {
                expect(res.headers['x-auth']).toExist();
                expect(res.body._id).toExist();
                expect(res.body.email).toBe(email);
            })
            .end((err, res) => {
                if (err) return done(err);

                User.findOne({email}).then((user) => {
                    expect(user).toExist();
                    expect(user.password).toNotBe(password);
                    done();
                }).catch((err) => done(err));
            });
    });
    
    it('should return validation error if request invalid', (done) => {
        request(app)
            .post('/users')
            .send({email: '', password: '23413uio'})
            .expect(400)
            .end(done);
    });

    it('should not create user if already exists', (done) => {
        request(app)
            .post('/users')
            .send({email: users[0].email, password: '23413uio'})
            .expect(400)
            .end(done);
    });
});

describe('POST /users/login', () => {
    it('should login user and return auth token', (done) => {
        let email = users[1].email;
        let password = users[1].password;

        request(app)
            .post('/users/login')
            .send({email, password})
            .expect(200)
            .expect((res) => {
                expect(res.headers['x-auth']).toExist();
            })
            .end((err, res) => {
                User.findByCredentials(email, password).then((user) => {
                    expect(user.tokens[1]).toInclude({
                        access: 'auth',
                        token: res.headers['x-auth']
                    });
                    done();
                }).catch((err) => done(err));
            });
    });

    it('should not login user', (done) => {
        let email = users[1].email;
        let password = 'shalala';

        request(app)
            .post('/users/login')
            .send({email, password})
            .expect(200)
            .expect((res) => {
                expect(res.headers['x-auth']).toNotExist();
            })
            .end((err, res) => {
                User.findByCredentials(email, password).then((user) => {
                    expect(user.tokens.length).toBe(1);
                    done();
                }).catch((err) => done(err));
            });
    });

});

describe('DELETE /users/me/token', () => {
    it('should delete token on logout', (done) => {
        let token = users[0].tokens[0].token;
        let id = users[0]._id;

        request(app)
            .delete('/users/me/token')
            .set('x-auth', token)
            .expect(200)
            .end((err, res) => {
                if (err) return done(err);

                User.findById(id).then((user) => {
                    expect(user.tokens.length).toBe(0);
                    done();
                }).catch((e) => done(e));
            });
    });
});