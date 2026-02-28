// This file contains mathematical utility functions, such as vector operations or collision detection algorithms.

pub fn add_vectors(a: (f32, f32), b: (f32, f32)) -> (f32, f32) {
    (a.0 + b.0, a.1 + b.1)
}

pub fn subtract_vectors(a: (f32, f32), b: (f32, f32)) -> (f32, f32) {
    (a.0 - b.0, a.1 - b.1)
}

pub fn dot_product(a: (f32, f32), b: (f32, f32)) -> f32 {
    a.0 * b.0 + a.1 * b.1
}

pub fn length(vector: (f32, f32)) -> f32 {
    (vector.0.powi(2) + vector.1.powi(2)).sqrt()
}

pub fn normalize(vector: (f32, f32)) -> (f32, f32) {
    let len = length(vector);
    if len == 0.0 {
        (0.0, 0.0)
    } else {
        (vector.0 / len, vector.1 / len)
    }
}

// Additional utility functions can be added here as needed.